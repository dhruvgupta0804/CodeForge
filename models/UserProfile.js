const mongoose = require('mongoose');

const UserProfileSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  tagVector: { type: Map, of: Number }, // { "graphs": 0.4, "dp": 0.8 }
  solvedProblems: [{ type: String }],   // ["1A", "2B", "3C"]
  rating: { type: Number },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserProfile', UserProfileSchema);