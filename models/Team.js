// models/Team.js
const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  teamName: { type: String, required: true },
  members: {
    type: [String],
    required: true,
    validate: {
      validator: function (v) {
        return v.length >= 1 && v.length <= 3;
      },
      message: 'A team must have between 1 and 3 members.',
    },
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Team', TeamSchema);
