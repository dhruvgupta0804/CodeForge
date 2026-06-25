const mongoose = require('mongoose');

const UserProfileSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  tagVector: { type: Map, of: Number },        // success rate per tag (for cosine similarity)
  weaknessByTag: { type: Map, of: Number },    // weakness score per tag (1 - success rate)
  solvedProblems: [{ type: String }],
  recentlySolved: [{                           // last 20 solved problems for recency scoring
    problemId: String,
    tags: [String],
    rating: Number,
    solvedAt: Number
  }],
  rating: { type: Number },
  minRating: { type: Number, default: 1000 },
  maxRating: { type: Number, default: 1400 },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserProfile', UserProfileSchema);