const mongoose = require('mongoose');

const ProblemCacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  problems: { type: Array, default: [] },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ProblemCache', ProblemCacheSchema);