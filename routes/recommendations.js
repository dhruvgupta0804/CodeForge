const express = require('express');
const router = express.Router();
const axios = require('axios');
const UserProfile = require('../models/UserProfile');
const ProblemCache = require('../models/ProblemCache');

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: CF Problemset Cache (refreshes every 24 hours)
// ─────────────────────────────────────────────────────────────────────────────

async function getCachedProblems() {
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  let cache = await ProblemCache.findOne({ key: 'cf_problemset' });
  const isStale = !cache || (Date.now() - new Date(cache.lastUpdated).getTime() > CACHE_TTL_MS);

  if (isStale) {
    console.log('[Cache] Refreshing CF problemset...');
    const cfResponse = await axios.get('https://codeforces.com/api/problemset.problems');
    const problems = cfResponse.data.result.problems;
    cache = await ProblemCache.findOneAndUpdate(
      { key: 'cf_problemset' },
      { key: 'cf_problemset', problems, lastUpdated: new Date() },
      { upsert: true, new: true }
    );
    console.log(`[Cache] Stored ${problems.length} problems.`);
  }
  return cache.problems;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: Build user profile (full rebuild each time, incremental-ready)
// ─────────────────────────────────────────────────────────────────────────────

async function buildUserProfile(username) {
  const [statusRes, infoRes] = await Promise.all([
    axios.get(`https://codeforces.com/api/user.status?handle=${username}&from=1&count=10000`),
    axios.get(`https://codeforces.com/api/user.info?handles=${username}`)
  ]);

  const submissions = statusRes.data.result;
  const rating = infoRes.data.result[0].rating || 1200;

  const tagStats = {};
  const solvedProblems = new Set();
  const solvedRatings = [];
  const recentlySolved = [];

  submissions.forEach(sub => {
    const problemId = `${sub.problem.contestId}${sub.problem.index}`;
    if (!sub.problem.tags) return;

    sub.problem.tags.forEach(tag => {
      if (!tagStats[tag]) tagStats[tag] = { solved: 0, total: 0, lastSolvedAt: null };
      tagStats[tag].total++;
      if (sub.verdict === 'OK') {
        if (!solvedProblems.has(problemId)) {
          tagStats[tag].solved++;
          const solvedAt = sub.creationTimeSeconds * 1000;
          if (!tagStats[tag].lastSolvedAt || solvedAt > tagStats[tag].lastSolvedAt) {
            tagStats[tag].lastSolvedAt = solvedAt;
          }
        }
        solvedProblems.add(problemId);
      }
    });

    if (sub.verdict === 'OK' && sub.problem.rating) {
      solvedRatings.push(sub.problem.rating);
      if (recentlySolved.length < 20) {
        recentlySolved.push({
          problemId: `${sub.problem.contestId}${sub.problem.index}`,
          tags: sub.problem.tags,
          rating: sub.problem.rating,
          solvedAt: sub.creationTimeSeconds * 1000
        });
      }
    }
  });

  // Tag vector: success rate per tag (for cosine similarity)
  const tagVector = {};
  // Weakness: 1 - success rate (for priority scoring)
  const weaknessByTag = {};

  Object.entries(tagStats).forEach(([tag, stats]) => {
    if (stats.total >= 3) {
      const successRate = stats.solved / stats.total;
      tagVector[tag] = successRate;
      weaknessByTag[tag] = 1 - successRate;
    }
  });

  // Rating range from percentile history
  let minRating = rating - 200;
  let maxRating = rating + 200;

  if (solvedRatings.length > 0) {
    solvedRatings.sort((a, b) => a - b);
    const p25 = solvedRatings[Math.floor(solvedRatings.length * 0.25)];
    const p75 = solvedRatings[Math.floor(solvedRatings.length * 0.75)];
    minRating = p25;
    maxRating = p75 + 200;
  }

  return { tagVector, weaknessByTag, solvedProblems: [...solvedProblems], recentlySolved, rating, minRating, maxRating };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: Cosine similarity
// ─────────────────────────────────────────────────────────────────────────────

function cosineSimilarity(vecA, vecB) {
  const allTags = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  let dotProduct = 0, magA = 0, magB = 0;

  allTags.forEach(tag => {
    const a = vecA[tag] || 0;
    const b = vecB[tag] || 0;
    dotProduct += a * b;
    magA += a * a;
    magB += b * b;
  });

  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: Score a problem
// weakness (3x) + rarity (2x) + recency (1.5x) + rating proximity (1x)
// ─────────────────────────────────────────────────────────────────────────────

function scoreProblem(problem, { weaknessByTag, solvedByCount, totalSimilarUsers, recentTags, userRating, desiredTopic }) {
  let score = 0;

  // 1. Weakness score (3x) — skip if user picked a desired topic (they want it regardless of weakness)
  if (!desiredTopic) {
    const tagWeaknessScores = problem.tags.map(tag => weaknessByTag[tag] || 0);
    const avgWeakness = tagWeaknessScores.length > 0
      ? tagWeaknessScores.reduce((a, b) => a + b, 0) / tagWeaknessScores.length
      : 0;
    score += avgWeakness * 3;
  }

  // 2. Rarity score (2x) — sweet spot: solved by 20-70% of similar users
  if (totalSimilarUsers > 0) {
    const solvedRatio = solvedByCount / totalSimilarUsers;
    let rarityScore = 0;
    if (solvedRatio >= 0.2 && solvedRatio <= 0.7) {
      rarityScore = 1 - Math.abs(solvedRatio - 0.45) * 2;
      rarityScore = Math.max(0, rarityScore);
    } else if (solvedRatio > 0.7) {
      rarityScore = 0.2;
    }
    score += rarityScore * 2;
  }

  // 3. Recency score (1.5x) — boost problems similar to recently solved tags
  const recentTagSet = new Set(recentTags);
  const tagOverlap = problem.tags.filter(t => recentTagSet.has(t)).length;
  const recencyScore = tagOverlap > 0 ? Math.min(tagOverlap / problem.tags.length, 1) : 0;
  score += recencyScore * 1.5;

  // 4. Rating proximity score (1x) — closer to user rating = better
  const ratingDiff = Math.abs((problem.rating || userRating) - userRating);
  const ratingScore = Math.max(0, 1 - ratingDiff / 400);
  score += ratingScore * 1;

  return score;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 1: Save/update user profile
// ─────────────────────────────────────────────────────────────────────────────

router.post('/update-profile', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });

  try {
    const profile = await buildUserProfile(username);
    await UserProfile.findOneAndUpdate(
      { username },
      {
        tagVector: profile.tagVector,
        weaknessByTag: profile.weaknessByTag,
        solvedProblems: profile.solvedProblems,
        recentlySolved: profile.recentlySolved,
        rating: profile.rating,
        minRating: profile.minRating,
        maxRating: profile.maxRating,
        lastUpdated: new Date()
      },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 2: Get enhanced collaborative recommendations
// Query params:
//   ?topic=greedy    → filter by desired topic instead of weak tags
//   ?refresh=true    → force profile rebuild
// ─────────────────────────────────────────────────────────────────────────────

router.get('/collaborative/:username', async (req, res) => {
  const { username } = req.params;
  // Optional: user-specified topic. If provided, overrides weak tag filtering.
  const desiredTopic = req.query.topic ? req.query.topic.toLowerCase().trim() : null;

  try {
    // ── Step 1: Get/refresh current user profile ──────────────────────────
    let currentUser = await UserProfile.findOne({ username });
    const STALE_THRESHOLD_MS = 30 * 60 * 1000;
    const forceRefresh = req.query.refresh === 'true';
    const isStale = forceRefresh || !currentUser ||
      (Date.now() - new Date(currentUser.lastUpdated).getTime() > STALE_THRESHOLD_MS);

    if (isStale) {
      const profile = await buildUserProfile(username);
      currentUser = await UserProfile.findOneAndUpdate(
        { username },
        {
          tagVector: profile.tagVector,
          weaknessByTag: profile.weaknessByTag,
          solvedProblems: profile.solvedProblems,
          recentlySolved: profile.recentlySolved,
          rating: profile.rating,
          minRating: profile.minRating,
          maxRating: profile.maxRating,
          lastUpdated: new Date()
        },
        { upsert: true, new: true }
      );
    }

    if (!currentUser.tagVector || Object.keys(currentUser.tagVector).length === 0) {
      return res.json({
        success: false,
        message: 'No submission history found. Solve some problems on Codeforces first.'
      });
    }

    // ── Step 2: Find top 10 similar users via cosine similarity ──────────
    const allUsers = await UserProfile.find({ username: { $ne: username } });
    const currentTagVector = Object.fromEntries(currentUser.tagVector);
    const currentWeakness = currentUser.weaknessByTag
      ? Object.fromEntries(currentUser.weaknessByTag)
      : {};

    let topSimilarUsers = [];
    if (allUsers.length > 0) {
      const similarities = allUsers.map(user => ({
        username: user.username,
        similarity: cosineSimilarity(currentTagVector, Object.fromEntries(user.tagVector)),
        solvedProblems: new Set(user.solvedProblems)
      }));
      similarities.sort((a, b) => b.similarity - a.similarity);
      topSimilarUsers = similarities.slice(0, 10);
    }

    // ── Step 3: Count how many similar users solved each unsolved problem ─
    const currentUserSolved = new Set(currentUser.solvedProblems);
    const problemSolvedCount = {};

    topSimilarUsers.forEach(({ solvedProblems }) => {
      solvedProblems.forEach(problemId => {
        if (!currentUserSolved.has(problemId)) {
          problemSolvedCount[problemId] = (problemSolvedCount[problemId] || 0) + 1;
        }
      });
    });

    const candidateProblemIds = new Set(Object.keys(problemSolvedCount));

    // ── Step 4: Recent tags (last 5 solved problems) ──────────────────────
    const recentTags = [];
    if (currentUser.recentlySolved && currentUser.recentlySolved.length > 0) {
      const sorted = [...currentUser.recentlySolved].sort((a, b) => b.solvedAt - a.solvedAt);
      sorted.slice(0, 5).forEach(p => recentTags.push(...(p.tags || [])));
    }

    // ── Step 5: Determine filter tags ────────────────────────────────────
    // If user gave a desired topic → filter by that topic only
    // Otherwise → filter by weak tags (weakness > 0.4 = less than 60% success)
    let filterTags;
    if (desiredTopic) {
      filterTags = new Set([desiredTopic]);
    } else {
      filterTags = new Set(
        Object.entries(currentWeakness)
          .filter(([_, w]) => w > 0.4)
          .map(([tag]) => tag)
      );
    }

    // ── Step 6: Get cached CF problemset ─────────────────────────────────
    const allProblems = await getCachedProblems();

    const userRating = currentUser.rating || 1200;
    const minRating = currentUser.minRating || userRating - 200;
    const maxRating = currentUser.maxRating || userRating + 200;

    // ── Step 7: Filter + score problems ──────────────────────────────────
    const scoredProblems = allProblems
      .filter(p => {
        const problemId = `${p.contestId}${p.index}`;
        const inRatingRange = p.rating !== undefined && p.rating >= minRating && p.rating <= maxRating;
        const notSolved = !currentUserSolved.has(problemId);
        const hasFilterTag = p.tags && p.tags.some(t => filterTags.has(t));
        const similarUserSolved = candidateProblemIds.has(problemId);
        // Include if: right rating range + not solved + (matches filter tag OR similar user solved it)
        return inRatingRange && notSolved && (hasFilterTag || similarUserSolved);
      })
      .map(p => {
        const problemId = `${p.contestId}${p.index}`;
        const solvedByCount = problemSolvedCount[problemId] || 0;

        const score = scoreProblem(p, {
          weaknessByTag: currentWeakness,
          solvedByCount,
          totalSimilarUsers: Math.max(topSimilarUsers.length, 1),
          recentTags,
          userRating,
          desiredTopic
        });

        // Build reason string
        let reason;
        if (desiredTopic) {
          reason = solvedByCount > 0
            ? `Your chosen topic "${desiredTopic}" • solved by ${solvedByCount} similar users`
            : `Your chosen topic: "${desiredTopic}"`;
        } else {
          const weakMatchingTags = p.tags.filter(t => filterTags.has(t));
          reason = solvedByCount > 0
            ? `Solved by ${solvedByCount} similar users • weak tags: ${weakMatchingTags.join(', ')}`
            : `Matches your weak topics: ${weakMatchingTags.join(', ')}`;
        }

        return {
          name: p.name,
          rating: p.rating,
          tags: p.tags,
          link: `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`,
          score: Math.round(score * 100) / 100,
          solvedBySimilarUsers: solvedByCount,
          reason
        };
      });

    // Sort by score descending, return top 20
    scoredProblems.sort((a, b) => b.score - a.score);
    const recommendations = scoredProblems.slice(0, 20);

    // ── Step 8: Top weak tags summary ────────────────────────────────────
    const topWeakTags = Object.entries(currentWeakness)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tag, weakness]) => ({ tag, weaknessPercent: Math.round(weakness * 100) }));

    res.json({
      success: true,
      recommendations,
      similarUsers: topSimilarUsers.slice(0, 5).map(u => u.username),
      topWeakTags,
      filteredByTopic: desiredTopic || null,
      meta: {
        userRating,
        ratingRange: { min: minRating, max: maxRating },
        totalCandidates: scoredProblems.length
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

module.exports = router;