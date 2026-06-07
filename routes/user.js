// routes/users.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// Endpoint to add a friend to a user's friend list
router.post('/add-friend', async (req, res) => {
  const { username, friendHandle } = req.body;
  if (!username || !friendHandle) {
    return res.status(400).json({ message: 'Missing username or friend handle' });
  }
  try {
    // Use $addToSet to avoid duplicate entries
    const updatedUser = await User.findOneAndUpdate(
        { username },
        { $addToSet: { friends: friendHandle } },
        { new: true, upsert: true }
      );
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'Friend added', friends: updatedUser.friends });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating friend list' });
  }
});

// Endpoint to get a user's friend list
router.get('/get-friends', async (req, res) => {
  // For example, if using an auth middleware that attaches user info:
  // const username = req.user.username;
  // Otherwise, you can use a query parameter (make sure to secure this in production)
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ message: 'Missing username' });
  }
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ friends: user.friends });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching friend list' });
  }
});


module.exports = router;
