import React, { useState, useEffect } from 'react';
import { ListGroup, Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import './friendspage.css';

function FriendsPage() {
  const [friends, setFriends] = useState([]);
  const [friendsData, setFriendsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  // Load friends from localStorage
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

  useEffect(() => {
    const username = localStorage.getItem('myHandle');
    if (!username) return;
    fetch(`${API_URL}/api/users/get-friends?username=${username}`)
      .then(res => res.json())
      .then(data => {
        if (data.friends) setFriends(data.friends);
      })
      .catch(() => setError('Error fetching friends.'));
  }, []);

  // Fetch friend data from CodeForces API
  useEffect(() => {
    if (friends.length === 0) return;
    setLoading(true);
    const handles = friends.join(';');
    fetch(`https://codeforces.com/api/user.info?handles=${handles}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'OK') {
          setFriendsData(data.result);
        } else {
          setError('Error fetching friend profiles.');
        }
      })
      .catch(() => setError('Error fetching friend profiles.'))
      .finally(() => setLoading(false));
  }, [friends]);

  return (
    <div className="friends-page">
      <h2 className="page-heading">My Friends</h2>
      {error && <Alert variant="danger">{error}</Alert>}
      {loading && <Spinner animation="border" variant="primary" />}
      {friendsData.length > 0 && (
        <ListGroup className="friends-list">
          {friendsData.map((friend) => (
            <ListGroup.Item
              action
              key={friend.handle}
              onClick={() => navigate(`/compare/${friend.handle}`)}
              className="friend-item"
            >
              <div className="d-flex justify-content-between align-items-center w-100">
                <span className="friend-handle">{friend.handle}</span>
                <span className="friend-rating">{friend.rating}</span>
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
      {friendsData.length === 0 && (
        <Alert variant="info">You have no friends added yet.</Alert>
      )}
    </div>
  );
}

export default FriendsPage;