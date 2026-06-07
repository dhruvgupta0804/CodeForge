// controllers/profileController.js
const Contest = require('../models/Contest');

exports.getProfile = async (req, res) => {
  try {
    // Use req.user (set by auth middleware) to get the user ID.
    const userId = req.user._id;
    // Fetch contests where the current user is a participant.
    const contests = await Contest.find({ participants: userId });
    res.json({ user: req.user, contests });
  } catch (error) {
    res.status(500).json({ error: 'Server Error' });
  }
};
