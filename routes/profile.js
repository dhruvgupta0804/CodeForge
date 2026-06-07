// routes/profile.js
const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middleware/auth');

// Protect the profile route with JWT authentication
router.get('/', authMiddleware, profileController.getProfile);

module.exports = router;
