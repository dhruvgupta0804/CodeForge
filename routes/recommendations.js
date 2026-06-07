const express = require('express');
const router = express.Router();
const axios = require('axios');
const UserProfile = require('../models/UserProfile');

// ─── Helper: build tag vector from CF submissions ───────────────────────────
async function buildUserProfile(username) {
  const [statusRes, infoRes] = await Promise.all([
    axios.get(`https://codeforces.com/api/user.status?handle=${username}&from=1&count=10000`),
    axios.get(`https://codeforces.com/api/user.info?handles=${username}`)
  ]);

  const submissions = statusRes.data.result;
  const rating = infoRes.data.result[0].rating || 1200;

  const tagStats = {};
  const solvedProblems = new Set();

  submissions.forEach(sub => {
    const problemId = `${sub.problem.contestId}${sub.problem.index}`;
    if (!sub.problem.tags) return;

    sub.problem.tags.forEach(tag => {
      if (!tagStats[tag]) tagStats[tag] = { solved: 0, total: 0 };
      tagStats[tag].total++;
      if (sub.verdict === 'OK') {
        tagStats[tag].solved++;
        solvedProblems.add(problemId);
      }
    });
  });

  // Build tag vector: success rate per tag (0 to 1)
  const tagVector = {};
  Object.entries(tagStats).forEach(([tag, stats]) => {
    if (stats.total >= 3) { // minimum 3 attempts to count
      tagVector[tag] = stats.solved / stats.total;
    }
  });

  return { tagVector, solvedProblems: [...solvedProblems], rating };
}

// ─── Helper: cosine similarity between two tag vectors ──────────────────────
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

// ─── Route 1: Save/update user profile ──────────────────────────────────────
// Call this when user logs in so their profile stays fresh
router.post('/update-profile', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });

  try {
    const { tagVector, solvedProblems, rating } = await buildUserProfile(username);

    await UserProfile.findOneAndUpdate(
      { username },
      { tagVector, solvedProblems, rating, lastUpdated: new Date() },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ─── Route 2: Get collaborative recommendations ──────────────────────────────
router.get('/collaborative/:username', async (req, res) => {
  const { username } = req.params;

  try {
    // Get current user profile
    let currentUser = await UserProfile.findOne({ username });

    // If no profile exists yet, build it on the fly
    if (!currentUser) {
      const { tagVector, solvedProblems, rating } = await buildUserProfile(username);
      currentUser = await UserProfile.findOneAndUpdate(
        { username },
        { tagVector, solvedProblems, rating, lastUpdated: new Date() },
        { upsert: true, new: true }
      );
    }

    // Guard: no submissions yet
    if (!currentUser.tagVector || currentUser.tagVector.size === 0) {
      return res.json({
        success: false,
        message: 'No submission history found. Solve some problems on Codeforces first.'
      });
    }

    // Get all other users from DB
    const allUsers = await UserProfile.find({ username: { $ne: username } });

    if (allUsers.length === 0) {
      return res.json({ success: true, recommendations: [], message: 'Not enough users yet' });
    }

    // Find top 5 most similar users
    const similarities = allUsers.map(user => ({
      username: user.username,
      similarity: cosineSimilarity(
        Object.fromEntries(currentUser.tagVector),
        Object.fromEntries(user.tagVector)
      ),
      solvedProblems: user.solvedProblems
    }));

    similarities.sort((a, b) => b.similarity - a.similarity);
    const topSimilarUsers = similarities.slice(0, 5);

    // Collect problems solved by similar users that current user hasn't solved
    const currentUserSolved = new Set(currentUser.solvedProblems);
    const candidateProblems = new Set();

    topSimilarUsers.forEach(({ solvedProblems }) => {
      solvedProblems.forEach(problemId => {
        if (!currentUserSolved.has(problemId)) {
          candidateProblems.add(problemId);
        }
      });
    });

    // Fetch problem details from Codeforces to get ratings
    const cfResponse = await axios.get('https://codeforces.com/api/problemset.problems');
    const allProblems = cfResponse.data.result.problems;

    // Filter to candidate problems within user's rating range
    const recommended = allProblems
      .filter(p => {
        const problemId = `${p.contestId}${p.index}`;
        return (
          candidateProblems.has(problemId) &&
          p.rating >= currentUser.rating - 100 &&
          p.rating <= currentUser.rating + 300
        );
      })
      .slice(0, 20)
      .map(p => ({
        name: p.name,
        rating: p.rating,
        tags: p.tags,
        link: `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`
      }));

    res.json({ success: true, recommendations: recommended, similarUsers: topSimilarUsers.map(u => u.username) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

module.exports = router;