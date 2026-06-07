// routes/auth.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const Challenge = require('../models/Challenge');
const User = require('../models/User');

const JWT_SECRET = 'your_jwt_secret_key'; // In production, store this in an environment variable

// POST /api/auth/login
// Initiates a login challenge for the given Codeforces username.
router.post('/login', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  
  // Fetch the full problem set from CodeForces to choose a random problem.
  let problemLink;
  try {
    const problemsResponse = await axios.get('https://codeforces.com/api/problemset.problems');
    if (problemsResponse.data.status !== 'OK') {
      return res.status(500).json({ error: 'Error fetching problems' });
    }
    const problems = problemsResponse.data.result.problems;
    // Filter to get only problems with contestId and index.
    const validProblems = problems.filter(p => p.contestId && p.index);
    if(validProblems.length === 0) {
      return res.status(500).json({ error: 'No valid problems found' });
    }
    const randomProblem = validProblems[Math.floor(Math.random() * validProblems.length)];
    // Construct the problem link (using contest-style link).
    problemLink = `https://codeforces.com/contest/${randomProblem.contestId}/problem/${randomProblem.index}`;
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error fetching problems' });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 120 * 1000); // 120 seconds from now

  const challenge = new Challenge({
    username,
    problemLink,
    challengeTime: now,
    expiresAt,
    passed: false,
  });

  try {
    await challenge.save();
    res.json({ challengeId: challenge._id, username, problemLink, expiresAt });
  } catch (err) {
    res.status(500).json({ error: 'Error creating challenge' });
  }
});

// GET /api/auth/challenge-check?challengeId=...
// Checks if the user has submitted a compilation error to the assigned problem.
router.get('/challenge-check', async (req, res) => {
  const { challengeId } = req.query;
  if (!challengeId) return res.status(400).json({ error: 'Challenge ID required' });

  try {
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) return res.status(404).json({ error: 'Challenge not found' });
    if (challenge.passed) return res.json({ success: true, message: 'Challenge already passed' });

    // Ensure the challenge hasn't expired.
    if (new Date() > challenge.expiresAt) {
      return res.status(400).json({ error: 'Challenge expired' });
    }

    // Extract contest ID and problem index from the problem link.
    // Example link: https://codeforces.com/contest/1/problem/A
    const linkParts = challenge.problemLink.split('/');
    const contestId = linkParts[4];
    const problemIndex = linkParts[6];

    // Call the CodeForces API to fetch submissions for the contest.
    const apiUrl = `https://codeforces.com/api/user.status?handle=${challenge.username}&contestId=${contestId}`;
    const response = await axios.get(apiUrl);
    const submissions = response.data.result;

    // Look for a submission with verdict "COMPILATION_ERROR"
    // that was submitted after the challenge was issued.
    const passedSubmission = submissions.find((sub) => {
      return sub.problem.index === problemIndex &&
             sub.verdict === 'COMPILATION_ERROR' &&
             new Date(sub.creationTimeSeconds * 1000) >= challenge.challengeTime;
    });

    if (passedSubmission) {
      challenge.passed = true;
      await challenge.save();

      // Create or update the user in the database.
      let user = await User.findOne({ username: challenge.username });
      if (!user) {
        user = new User({ username: challenge.username, friends: [] });
        await user.save();
      }

      // Generate JWT token
      const token = jwt.sign({ username: challenge.username, _id: user._id }, JWT_SECRET, { expiresIn: '1h' });

      return res.json({ success: true, message: 'Challenge passed. Login successful.', token });
    } else {
      return res.status(400).json({ error: 'Challenge not passed yet.' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error checking challenge' });
  }
});

module.exports = router;
