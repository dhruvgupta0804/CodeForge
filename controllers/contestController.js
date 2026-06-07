// controllers/contestController.js
const Contest = require('../models/Contest');

// Create a new contest
exports.createContest = async (req, res) => {
  try {
    // Expecting a title and a comma-separated list of problem IDs from the form
    const { title, problems } = req.body;
    // Convert the problems string into an array (e.g., "123A, 456B" → ["123A", "456B"])
    const problemArray = problems.split(',').map(p => p.trim());
    
    const contest = new Contest({
      title,
      problems: problemArray,
      createdBy: req.user._id // assuming req.user is set after authentication
    });
    await contest.save();
    res.status(201).json({ success: true, contest });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Join an existing contest
exports.joinContest = async (req, res) => {
  try {
    const { contestId } = req.params;
    const contest = await Contest.findById(contestId);
    if (!contest) {
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }
    // Add the user if not already a participant
    if (!contest.participants.includes(req.user._id)) {
      contest.participants.push(req.user._id);
      await contest.save();
    }
    res.status(200).json({ success: true, contest });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get contest analytics for the logged-in user (for their profile)
exports.getUserContestAnalytics = async (req, res) => {
  try {
    const contests = await Contest.find({ participants: req.user._id });
    // Optionally, calculate additional analytics if needed
    res.status(200).json({ success: true, contests });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
