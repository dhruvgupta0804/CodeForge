// src/components/Community.js
import React, { useEffect, useState } from 'react';
import { Card, Button, Form, Alert, Container } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import './community.css'; // Adjust the path as needed
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const Community = ({ currentUser }) => {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchPosts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/community/posts`);
      const data = await res.json();
      setPosts(data);
    } catch (err) {
      console.error('Error fetching posts:', err);
    }
  };

  useEffect(() => {
    const socket = io(API_URL);
    fetchPosts();

    socket.on('postCreated', (post) => setPosts(prev => [post, ...prev])); //if 2 posts arrive at same time then prev stores the latest state for second update after first update on similar instance is done

    socket.on('postUpdated', (updatedPost) => {
      setPosts(prev => prev.map(post =>
        post._id === updatedPost._id ? updatedPost : post
      ));
    });

    return () => {
      socket.off('postCreated');
      socket.off('postUpdated');
    };
  }, []);

  const handlePostChange = (e) => {
    setNewPost({ ...newPost, [e.target.name]: e.target.value });
  };

  const submitPost = async (e) => {
    e.preventDefault(); //prevent page refresh

    if (!newPost.title || !newPost.content) {
      setError('Please fill in all fields');
      return;
    }

    if (!currentUser) {
      setError('You must be logged in (via Codeforces) to post');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/community/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newPost, author: currentUser })
      });
      //clearing the form for next input ie clearing title anc content values in react state
      if (res.ok) {
        setNewPost({ title: '', content: '' });
        setError('');
        fetchPosts();
      } else {
        const data = await res.json();
        setError(data.error || 'Error creating post');
      }
    } catch (err) {
      setError('Error creating post');
    }
  };

  return (
    <Container className="community-container">
      <div className="community-header">
        <h3>Community Blogs</h3>
        <p>Share your Announcements/Thoughts with fellow CodeForge users!</p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Form onSubmit={submitPost} className="post-form">
        <Form.Group controlId="postTitle">
          <Form.Label>Title</Form.Label>
          <Form.Control
            type="text"
            name="title"
            placeholder="Enter title"
            value={newPost.title}
            onChange={handlePostChange}
          />
        </Form.Group>
        <Form.Group controlId="postContent" className="mt-2">
          <Form.Label>Content</Form.Label>
          <Form.Control
            as="textarea"
            name="content"
            placeholder="Enter your blog content"
            value={newPost.content}
            onChange={handlePostChange}
          />
        </Form.Group>
        <Button
          variant="dark"
          type="submit"
          className="mt-3"
          disabled={!currentUser}
        >
          Post
        </Button>
      </Form>

      {posts.map(post => {
        const userVote = currentUser && post.voted_by
          ? post.voted_by.find(v => v.user === currentUser)
          : null;

        return (
          <Card key={post._id} className="blog-card">
            <Card.Body>
              <Card.Title>{post.title}</Card.Title>
              <Card.Subtitle className="mb-2 text-muted">
                {post.author} - {new Date(post.createdAt).toLocaleString()}
              </Card.Subtitle>
              <Card.Text>
                {post.content.length > 200
                  ? post.content.slice(0, 200) + '...'
                  : post.content}
              </Card.Text>
              <div className="vote-container">
                <div className="vote-buttons">
                  <Button
                    className={`upvote ${userVote && userVote.vote === 1 ? "active" : ""}`}
                    size="sm"
                    variant='outline-dark'
                    onClick={() => {
                      if (!currentUser) return alert("Please log in to vote");
                      fetch(`${API_URL}/api/community/posts/${post._id}/vote`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'up', user: currentUser })
                      }).then(fetchPosts);
                    }}
                  >
                    ▲
                  </Button>
                  <span className="vote-count"> {post.votes} </span>
                  <Button
                    className={`downvote ${userVote && userVote.vote === -1 ? "active" : ""}`}
                    size="sm"
                    variant='outline-dark'
                    onClick={() => {
                      if (!currentUser) return alert("Please log in to vote");
                      fetch(`${API_URL}/api/community/posts/${post._id}/vote`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'down', user: currentUser })
                      }).then(fetchPosts);
                    }}
                  >
                    ▼
                  </Button>
                </div>
                <div className="comments-button-wrapper">
                  <Button
                    className="comments-btn"
                    variant="outline-warning"
                    onClick={() => navigate(`/blog/${post._id}`)}
                  >
                    Comments
                  </Button>
                </div>
              </div>
            </Card.Body>
          </Card>
        );
      })}
    </Container>
  );
};

export default Community;