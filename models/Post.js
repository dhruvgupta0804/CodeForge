const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Reply schema with vote tracking
const ReplySchema = new Schema({
  author: { type: String, required: true },
  content: { type: String, required: true },
  votes: { type: Number, default: 0 },
  voted_by: [{ user: String, vote: Number }],
  createdAt: { type: Date, default: Date.now },
  replies: [] // recursive replies
});
// Allow nested replies recursively
ReplySchema.add({ replies: [ReplySchema] });

const PostSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: String, required: true },
  votes: { type: Number, default: 0 },
  voted_by: [{ user: String, vote: Number }],
  createdAt: { type: Date, default: Date.now },
  replies: [ReplySchema]
});

module.exports = mongoose.model('Post', PostSchema);
