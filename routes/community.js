// routes/community.js
const express = require('express');
const router = express.Router();
const Post = require('../models/Post');

// GET all posts (sorted by newest)
router.get('/posts', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching posts' });
  }
});

// GET a single post by ID with logging for debugging
/* over here also I could give private post feature like create a isvisible array with names of
those with whom post has to made visible and then if another person access all posts then he/she
would see only those posts in which his name was mentioned in isvisible array */
router.get('/posts/:postId', async (req, res) => {
  console.log("Fetching post with id:", req.params.postId);
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).json({ error: 'Error fetching post' });
  }
});

// POST: Create a new post (uses author from request)
/* if I want some specific users to see the post then on setting connection I should create a map 
of all users with their name refering to socket id and then in body Is houdl send which all users 
to be allowed in that scenario I could also allow only private to me feature like I could only see 
the post 
allowedUsers.forEach(
 user => {
   const socketId =
   onlineUsers.get(user);
   if(socketId)
   {
      io.to(socketId)
        .emit(
          'postCreated',
          newPost
        );
   }
 });
*/
router.post('/posts', async (req, res) => {
  const { title, content, author } = req.body;
  try {
    const newPost = new Post({ title, content, author });
    await newPost.save();
    const io = req.app.get('io');
    if (io) io.emit('postCreated', newPost);
    res.status(201).json(newPost);
  } catch (error) {
    res.status(500).json({ error: 'Error creating post' });
  }
});

// POST: Vote on a post (only one vote per user; update if necessary)
router.post('/posts/:postId/vote', async (req, res) => {
  const { postId } = req.params;
  const { type, user } = req.body; // type: 'up' or 'down'
  if (!user) return res.status(400).json({ error: 'User ID required for voting' });
  try {
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    
    let voteRecord = post.voted_by.find(v => v.user === user);
    if (voteRecord) {
      // If same vote, do nothing
      if ((voteRecord.vote === 1 && type === 'up') || (voteRecord.vote === -1 && type === 'down')) {
         return res.json(post);
      } else {
         // Change vote: remove previous vote value and add new vote
         post.votes = post.votes - voteRecord.vote;
         voteRecord.vote = type === 'up' ? 1 : -1;
         post.votes = post.votes + voteRecord.vote;
      }
    } else {
      // New vote
      const voteVal = type === 'up' ? 1 : -1;
      post.voted_by.push({ user, vote: voteVal });
      post.votes += voteVal;
    }
    await post.save();
    const io = req.app.get('io');
    if (io) io.emit('postUpdated', post);
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: 'Error updating vote' });
  }
});

// POST: Add a reply (or nested reply)
router.post('/posts/:postId/reply', async (req, res) => {
  const { postId } = req.params;
  const { author, content, parentReplyId } = req.body;
  try {
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    
    const newReply = {
      author,
      content,
      votes: 0,
      voted_by: [],
      createdAt: new Date(),
      replies: []
    };
    
    if (parentReplyId) {
      const found = await addReply(post.replies, parentReplyId, newReply);
      if (!found) return res.status(404).json({ error: 'Parent reply not found' });
    } else { // if nothing like parentreply and user wants to add direct reply on post
      post.replies.push(newReply);
    }
    
    await post.save();
    const io = req.app.get('io');
    if (io) io.emit('postUpdated', post);
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: 'Error adding reply' });
  }
});

// POST: Vote on a reply (nested within a post)
router.post('/posts/:postId/reply/:replyId/vote', async (req, res) => {
  const { postId, replyId } = req.params;
  const { type, user } = req.body;
  if (!user) return res.status(400).json({ error: 'User ID required for voting' });
  try {
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    
    const updateReplyVote = (replies) => {
      for (let reply of replies) {
        if (reply._id.toString() === replyId) {
          let voteRecord = reply.voted_by.find(v => v.user === user);
          if (voteRecord) {
            if ((voteRecord.vote === 1 && type === 'up') || (voteRecord.vote === -1 && type === 'down')) {
              return reply;
            } else {
              reply.votes = reply.votes - voteRecord.vote;
              voteRecord.vote = type === 'up' ? 1 : -1;
              reply.votes = reply.votes + voteRecord.vote;
              return reply;
            }
          } else {
            const voteVal = type === 'up' ? 1 : -1;
            reply.voted_by.push({ user, vote: voteVal });
            reply.votes += voteVal;
            return reply;
          }
        }
        if (reply.replies && reply.replies.length) {
          const found = updateReplyVote(reply.replies);
          if (found) return found;
        }
      }
      return null;
    };

    const updatedReply = updateReplyVote(post.replies);
    if (!updatedReply) return res.status(404).json({ error: 'Reply not found' });
    
    await post.save();
    const io = req.app.get('io');
    if (io) io.emit('postUpdated', post);
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: 'Error updating reply vote' });
  }
});

// Helper function to recursively add a reply
/* first search replies direct to post - level 1 if not found recursively srearch in nested 
replies to direct replies with is level 2 and so on recursively goes to find level as we dont 
know in which level he actually wants to reply */
async function addReply(replies, parentId, newReply) {
  for (let reply of replies) {
    if (reply._id.toString() === parentId) {
      reply.replies.push(newReply);
      return true;
    } else if (reply.replies && reply.replies.length) {
      const found = await addReply(reply.replies, parentId, newReply);
      if (found) return true;
    }
  }
  return false;
}

module.exports = router;
