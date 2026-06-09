const mongoose = require('mongoose');

const UserProfileSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  tagVector: { type: Map, of: Number },
  solvedProblems: [{ type: String }],
  rating: { type: Number },
  minRating: { type: Number, default: 1000 }, // ← added
  maxRating: { type: Number, default: 1400 }, // ← added
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserProfile', UserProfileSchema);