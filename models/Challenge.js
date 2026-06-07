// models/Challenge.js
const mongoose = require('mongoose');

const ChallengeSchema = new mongoose.Schema({
  username: { type: String, required: true },
  problemLink: { type: String, required: true },
  challengeTime: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  passed: { type: Boolean, default: false },
});

module.exports = mongoose.model('Challenge', ChallengeSchema);
