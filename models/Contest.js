// models/Contest.js
const mongoose = require('mongoose');

const ProblemSchema = new mongoose.Schema({
  contestLink: { type: String, required: true },
  contestId: { type: String },
  problemIndex: { type: String }, // 'A'...'Z'
  rating: { type: Number },
});

const ParticipantSchema = new mongoose.Schema({
  isTeam: { type: Boolean, default: false },
  teamName: { type: String },        // used if isTeam = true
  members: [{ type: String }],       // used if isTeam = true
  username: { type: String },        // used if isTeam = false
  submissions: [
    {
      problemId: { type: mongoose.Schema.Types.ObjectId },
      solved: { type: Boolean, default: false },
      wrongSubmissions: { type: Number, default: 0 },
      solvedTime: { type: Number }, // in minutes from contest start
    },
  ],
});

const ContestSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, unique: true, index: true },
  startTime: { type: Date, required: true },
  duration: { type: Number, required: true },
  admin: { type: String, required: true },
  // Enforce a maximum of 26 problems:
  problems: {
    type: [ProblemSchema],
    validate: {
      validator: function (val) {
        return val.length <= 26;
      },
      message: 'Cannot exceed 26 problems (A–Z).',
    },
  },
  participants: [ParticipantSchema],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Contest', ContestSchema);
