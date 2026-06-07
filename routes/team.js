// routes/team.js
const express = require('express');
const router = express.Router();
const Team = require('../models/Team');

// Endpoint to create a team
router.post('/create', async (req, res) => {
  try {
    const { teamName, members } = req.body;

    // Validate required fields
    if (!teamName || !members) {
      return res.status(400).json({ error: 'Team name and members are required.' });
    }

    // Ensure members is an array
    if (!Array.isArray(members)) {
      return res.status(400).json({ error: 'Members must be provided as an array.' });
    }

    // Filter out empty strings or whitespace-only entries
    const filteredMembers = members.filter(m => m && m.trim() !== '');

    if (filteredMembers.length < 1 || filteredMembers.length > 3) {
      return res.status(400).json({ error: 'A team must have between 1 and 3 valid members.' });
    }

    // Create and save the team
    const team = new Team({
      teamName,
      members: filteredMembers,
    });
    await team.save();

    res.json({ success: true, team });
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to get all teams (to display in the Teams tab)
router.get('/', async (req, res) => {
  try {
    const teams = await Team.find();
    res.json({ success: true, teams });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
