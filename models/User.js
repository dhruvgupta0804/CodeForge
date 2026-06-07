// models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  friends: [{ type: String }], // list of friend usernames
});

module.exports = mongoose.model('User', UserSchema);
