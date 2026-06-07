// src/components/BlogDetailPage.js
import React, { useEffect, useState } from 'react';
import { Card, Button, Form, Alert, Container } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import './community.css';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const socket = io(`${API_URL}`);


// Component for individual reply item
const ReplyItem = ({ reply, loggedInUser, voteReply, submitReply }) => {
  const [replyInput, setReplyInput] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const replyUserVote = loggedInUser && reply.voted_by ? reply.voted_by.find(v => v.user === loggedInUser) : null;

  return (
    <Card className="blog-card reply-card">
      <Card.Body className="py-2 px-3">
        <Card.Subtitle className="mb-1 text-muted small">
          <strong>{reply.author}</strong> • {new Date(reply.createdAt).toLocaleString()}
        </Card.Subtitle>
        <Card.Text className="my-2">{reply.content}</Card.Text>
        <div className="vote-container mb-1">
          <div className="vote-buttons">
            <Button
              className={`upvote ${replyUserVote && replyUserVote.vote === 1 ? "active" : ""}`}
              size="sm"
              variant='outline-dark'
              onClick={() => voteReply(reply._id, 'up')}
            >
              ▲
            </Button>
            <span className="vote-count"> {reply.votes} </span>
            <Button
              className={`downvote ${replyUserVote && replyUserVote.vote === -1 ? "active" : ""}`}
              size="sm"
              variant='outline-dark'
              onClick={() => voteReply(reply._id, 'down')}
            >
              ▼
            </Button>
          </div>
          
          <Button 
            variant="link" 
            className="p-0 text-dark ms-3"
            onClick={() => setShowReplyForm(!showReplyForm)}
          >
            {showReplyForm ? 'Cancel' : 'Reply'}
          </Button>
        </div>
        
        {showReplyForm && (
          <Form className="mt-2">
            <Form.Group className="d-flex">
              <Form.Control 
                type="text" 
                placeholder="Reply..." 
                size="sm"
                value={replyInput} 
                onChange={(e) => setReplyInput(e.target.value)} 
              />
              <Button 
                variant="dark" 
                size="sm"
                className="ms-2" 
                onClick={() => { 
                  submitReply(reply._id, replyInput); 
                  setReplyInput(''); 
                  setShowReplyForm(false);
                }}
              >
                Send
              </Button>
            </Form.Group>
          </Form>
        )}

        {reply.replies && reply.replies.length > 0 && (
          <div className="nested-reply mt-2">
            {reply.replies.map(childReply => (
              <ReplyItem 
                key={childReply._id} 
                reply={childReply} 
                loggedInUser={loggedInUser} 
                voteReply={voteReply} 
                submitReply={submitReply} 
              />
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

const BlogDetailPage = ({ currentUser }) => {
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [mainReplyText, setMainReplyText] = useState('');
  const [error, setError] = useState('');

  const loggedInUser = currentUser || localStorage.getItem('myHandle');

  const fetchPost = async () => {
    try {
      const res = await fetch(`${API_URL}/api/community/posts/${postId}`);
      if (!res.ok) throw new Error('Failed to fetch post');
      const data = await res.json();
      setPost(data);
    } catch (err) {
      console.error('Error fetching post:', err);
      setError('Error fetching post.');
    }
  };

  useEffect(() => {
    fetchPost();
    socket.on('postUpdated', (updatedPost) => {
      if (updatedPost._id === postId) setPost(updatedPost);
    });
    return () => {
      socket.off('postUpdated');
    };
  }, [postId]);

  const submitReply = async (parentReplyId, text) => {
    if (!text.trim()) return;
    if (!loggedInUser) {
      setError('You must be logged in to reply');
      return;
    }
    try {
      await fetch(`${API_URL}/api/community/posts/${postId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, author: loggedInUser, parentReplyId })
      });
      setError('');
      fetchPost();
    } catch (err) {
      console.error('Error submitting reply:', err);
      setError('Error submitting reply.');
    }
  };

  const votePost = async (type) => {
    if (!loggedInUser) return alert("Please log in to vote");
    await fetch(`${API_URL}/api/community/posts/${postId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, user: loggedInUser })
    });
    fetchPost();
  };

  const voteReply = async (replyId, type) => {
    if (!loggedInUser) return alert("Please log in to vote");
    await fetch(`${API_URL}/api/community/posts/${postId}/reply/${replyId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, user: loggedInUser })
    });
    fetchPost();
  };

  if (!post) {
    return (
      <Container>
        <p>Loading post...</p>
        {error && <Alert variant="danger">{error}</Alert>}
      </Container>
    );
  }

  const userVote = loggedInUser && post.voted_by ? post.voted_by.find(v => v.user === loggedInUser) : null;

  return (
    <Container className="community-container">
      <Card className="blog-card my-3">
        <Card.Body>
          <Card.Title>{post.title}</Card.Title>
          <Card.Subtitle className="mb-2 text-muted">
            {post.author} - {new Date(post.createdAt).toLocaleString()}
          </Card.Subtitle>
          <Card.Text>{post.content}</Card.Text>
          <div className="vote-container">
            <div className="vote-buttons">
              <Button
                className={`upvote ${userVote && userVote.vote === 1 ? "active" : ""}`}
                size="sm"
                variant='outline-dark'
                onClick={() => votePost('up')}
              >
                ▲
              </Button>
              <span className="vote-count"> {post.votes} </span>
              <Button
                className={`downvote ${userVote && userVote.vote === -1 ? "active" : ""}`}
                size="sm"
                variant='outline-dark'
                onClick={() => votePost('down')}
              >
                ▼
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>
      
      <div className="community-header">
        <h3>Comments</h3>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      
      <Form className="post-form mb-3">
        <Form.Group>
          <Form.Control
            as="textarea"
            placeholder="Add a reply..."
            value={mainReplyText}
            onChange={(e) => setMainReplyText(e.target.value)}
          />
        </Form.Group>
        <Button 
          variant="dark" 
          className="mt-3 w-100" 
          onClick={() => { 
            submitReply(null, mainReplyText); 
            setMainReplyText(''); 
          }}
        >
          Submit Reply
        </Button>
      </Form>
      
      {post.replies && post.replies.length > 0 && (
        <div className="mt-3">
          {post.replies.map(reply => (
            <ReplyItem 
              key={reply._id} 
              reply={reply} 
              loggedInUser={loggedInUser} 
              voteReply={voteReply} 
              submitReply={submitReply} 
            />
          ))}
        </div>
      )}
    </Container>
  );
};

export default BlogDetailPage;