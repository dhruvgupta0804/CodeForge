// routes/contest.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Contest = require('../models/Contest');
const Team = require('../models/Team'); // For team creation/lookup if needed

// 1. Create a new custom contest and return contest_id and contest_slug
router.post('/create', async (req, res) => {
  try {
    const { name, startTime, duration, admin, problems } = req.body;
    if (!name || !startTime || !duration || !admin) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    // Initialize with the admin as an individual participant
    const contest = new Contest({
      name,
      startTime: new Date(startTime),
      duration,
      admin,
      problems: problems || [],
      participants: [{
        isTeam: false,
        username: admin,
        submissions: [],
      }],
    });
    await contest.save();
    // Generate a unique slug, e.g. "contest-<id>"
    contest.slug = `contest-${contest._id}`;
    await contest.save();
    res.json({ success: true, contestId: contest._id, contestLink: contest.slug });
  } catch (error) {
    console.error('Error creating contest:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Add a problem manually
router.post('/:contestId/add-problem', async (req, res) => {
  try {
    const { contestId } = req.params;
    const { problemLink } = req.body;
    const parts = problemLink.split('/');
    const contestCode = parts[4];
    const problemIndex = parts[6];
    const contest = await Contest.findById(contestId);
    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }
    // Enforce maximum 26 problems
    if (contest.problems.length >= 26) {
      return res.status(400).json({ error: 'Cannot add more than 26 problems.' });
    }
    //adding the problem in format of problem schema
    const problemObj = {
      contestLink: problemLink,
      contestId: contestCode,
      problemIndex,
      rating: null,
    };
    contest.problems.push(problemObj);
    await contest.save();
    res.json({ success: true, contest });
  } catch (error) {
    console.error('Error adding problem:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Add a random problem by rating
router.post('/:contestId/add-random', async (req, res) => {
  try {
    const { contestId } = req.params;
    const { rating } = req.body;
    const contest = await Contest.findById(contestId);
    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }
    if (contest.problems.length >= 26) {
      return res.status(400).json({ error: 'Cannot add more than 26 problems.' });
    }
    const response = await axios.get('https://codeforces.com/api/problemset.problems');
    if (response.data.status !== 'OK') {
      throw new Error('Error fetching problemset');
    }
    const allProblems = response.data.result.problems;
    const matching = allProblems.filter((p) => p.rating === rating);
    if (matching.length === 0) {
      return res.status(400).json({ error: 'No problem found for given rating' });
    }
    const randomProblem = matching[Math.floor(Math.random() * matching.length)];
    const probLink = `https://codeforces.com/contest/${randomProblem.contestId}/problem/${randomProblem.index}`;
    const problemObj = {
      contestLink: probLink,
      contestId: randomProblem.contestId,
      problemIndex: randomProblem.index,
      rating,
    };
    contest.problems.push(problemObj);
    await contest.save();
    res.json({ success: true, contest });
  } catch (error) {
    console.error('Error adding random problem:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Join as an individual
router.post('/:contestId/join', async (req, res) => {
  try {
    const { contestId } = req.params;
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }
    const contest = await Contest.findById(contestId);
    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }
    // Check if user is already added as individual
    const existing = contest.participants.find(p => p.isTeam === false && p.username === username);
    if (!existing) {
      contest.participants.push({
        isTeam: false,
        username,
        submissions: [],
      });
      await contest.save();
    }
    res.json({ success: true, message: 'Joined contest successfully', contest });
  } catch (error) {
    console.error('Error joining contest (individual):', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Join as a team
router.post('/:contestId/join-team', async (req, res) => {
  try {
    const { contestId } = req.params;
    const { teamName, members } = req.body;
    if (!teamName) {
      return res.status(400).json({ error: 'Team name is required.' });
    }
    let finalMembers = [];
    if (members) {
      if (!Array.isArray(members)) {
        return res.status(400).json({ error: 'Members must be provided as an array.' });
      }
      const filteredMembers = members.filter(m => m && m.trim() !== '');
      if (filteredMembers.length < 1 || filteredMembers.length > 3) {
        return res.status(400).json({ error: 'Team name + 1–3 members required.' });
      }
      // Create a new team with the given members
      const newTeam = new Team({ teamName, members: filteredMembers });
      await newTeam.save();
      finalMembers = filteredMembers;
    } else {
      // If no members provided, try to find an existing team by teamName
      const existingTeam = await Team.findOne({ teamName });
      if (!existingTeam) {
        return res.status(400).json({ error: 'Team not found. Please create your team first.' });
      }
      finalMembers = existingTeam.members;
    }
    const contest = await Contest.findById(contestId);
    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }
    // Check if this team is already added
    const existing = contest.participants.find(p => p.isTeam && p.teamName === teamName);
    if (!existing) {
      contest.participants.push({
        isTeam: true,
        teamName,
        members: finalMembers,
        submissions: [],
      });
      await contest.save();
    }
    // Remove individual participants who are also in this team
    contest.participants = contest.participants.filter(p => {
      if (p.isTeam) return true;
      if (!p.isTeam && finalMembers.includes(p.username)) return false;
      return true;
    });
    await contest.save();
    res.json({ success: true, message: 'Team joined contest successfully', contest });
  } catch (error) {
    console.error('Error joining as team:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Get contest details by slug
router.get('/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const contest = await Contest.findOne({ slug });
    if (!contest) {
      return res.status(404).json({ success: false, error: 'Contest not found' });
    }
    res.json({ success: true, contest });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Get leaderboard by slug
// If a user is in a team, do NOT display them individually.
router.get('/slug/:slug/leaderboard', async (req, res) => {
  try {
    const { slug } = req.params;
    const contest = await Contest.findOne({ slug });
    if (!contest) {
      return res.status(404).json({ success: false, error: 'Contest not found' });
    }
    const contestStart = new Date(contest.startTime);
    const problems = contest.problems;

    // Build a set of usernames that are in any team.
    const usersInTeams = new Set();
    contest.participants.forEach(p => {
      if (p.isTeam && p.members) {
        p.members.forEach(m => usersInTeams.add(m));
      }
    });

    // Create final list: include team participants; exclude individual participants if they're also in a team.
    const finalParticipants = contest.participants.filter(p => {
      if (p.isTeam) return true;
      if (!p.isTeam && usersInTeams.has(p.username)) return false;
      return true;
    });

    // For each participant, compute solved count and penalty (dummy logic for now)
    const leaderboard = [];
    for (const participant of finalParticipants) {
      let solvedCount = 0;
      let totalPenalty = 0;
      // Here you would normally compute based on Codeforces submissions.
      leaderboard.push({
        isTeam: participant.isTeam,
        username: participant.username || '',
        teamName: participant.teamName || '',
        members: participant.members || [],
        solvedCount,
        penalty: totalPenalty,
      });
    }
    /*
    const leaderboard = [];
    const contestStart = new Date(contest.startTime);
    const contestEnd = new Date(
      contestStart.getTime() +
      contest.duration * 60 * 1000
    );

    for (const participant of finalParticipants) {
      const handles = participant.isTeam
        ? participant.members
        : [participant.username];
      const solvedProblems = new Set();
      const wrongAttempts = {};
      let solvedCount = 0;
      let totalPenalty = 0;
      for (const handle of handles) {
        const response = await axios.get(
          `https://codeforces.com/api/user.status?handle=${handle}`
        );
        const submissions = response.data.result;
        for (const sub of submissions) {
          const submitTime = new Date(
            sub.creationTimeSeconds * 1000
          );
          if (
            submitTime < contestStart || submitTime > contestEnd
          ) {
            continue;
          }
          const problemKey =
            `${sub.problem.contestId}-${sub.problem.index}`;
          const isContestProblem =
            contest.problems.some(
              p =>
                p.contestId === sub.problem.contestId &&
                p.index === sub.problem.index
            );
          if (!isContestProblem) {
            continue;
          }
          if (solvedProblems.has(problemKey)) {
            continue;
          }
          if (sub.verdict === 'OK') {
            solvedProblems.add(problemKey);
            const minutesFromStart =
              Math.floor(
                (submitTime - contestStart)
                / (1000 * 60)
              );
            totalPenalty +=
              minutesFromStart +
              20 * (wrongAttempts[problemKey] || 0);
          } else {
            wrongAttempts[problemKey] =
              (wrongAttempts[problemKey] || 0) + 1;

          }
        }
      }
      solvedCount = solvedProblems.size;
      leaderboard.push({
        isTeam: participant.isTeam,
        username: participant.username || '',
        teamName: participant.teamName || '',
        members: participant.members || [],
        solvedCount,
        penalty: totalPenalty,
      });
    } 
    */
    // Sort leaderboard by solvedCount descending and penalty ascending.
    leaderboard.sort((a, b) => {
      if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount;
      return a.penalty - b.penalty;
    });

    res.json({ success: true, leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Get all contests endpoint
router.get('/', async (req, res) => {
  try {
    const contests = await Contest.find();
    res.json({ success: true, contests });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
