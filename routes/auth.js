const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// ─── Register ─────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ message: 'Username and password are required' });

  if (password.length < 6)
    return res.status(400).json({ message: 'Password must be at least 6 characters' });

  try {
    // Check if username already exists
    const existing = await User.findOne({ username });
    if (existing)
      return res.status(400).json({ message: 'Username already taken' });

    // Verify this is a real Codeforces handle
    try {
      const cfRes = await fetch(`https://codeforces.com/api/user.info?handles=${username}`);
      const cfData = await cfRes.json();
      if (cfData.status !== 'OK') {
        return res.status(400).json({ 
          message: 'Codeforces handle not found. Username must be your real Codeforces handle.' 
        });
      }
    } catch (err) {
      return res.status(500).json({ 
        message: 'Could not verify Codeforces handle. Try again.' 
      });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    const user = new User({ username, password: hashed });
    await user.save();

    // Issue JWT immediately after register
    const token = jwt.sign(
      { username, _id: user._id },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ success: true, token, username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Login ────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ message: 'Username and password are required' });

  try {
    const user = await User.findOne({ username });
    if (!user)
      return res.status(400).json({ message: 'Invalid username or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: 'Invalid username or password' });

    const token = jwt.sign(
      { username, _id: user._id },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ success: true, token, username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;