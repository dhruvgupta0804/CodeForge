// client/src/Dashboard.js
import React, { useState } from 'react';
import './Dashboard.css';

function Dashboard() {
  const [yourHandle, setYourHandle] = useState('');
  const [friendHandle, setFriendHandle] = useState('');
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const handleCompare = async () => {
    // Validate both input fields are non-empty
    if (!yourHandle.trim() || !friendHandle.trim()) {
      setError("Both handles are required.");
      return;
    }
    setLoading(true);
    setError('');
    setUsers([]);

    // Create a comma-separated string with both handles
    const handles = `${yourHandle.trim()};${friendHandle.trim()}`;
    console.log(handles);
    try {
      const response = await fetch(`${API_URL}/api/users?handles=${handles}`);
      const data = await response.json();
      if (data.status === 'OK' && data.result.length > 0) {
        if (data.result.length !== 2) {
          setError("Could not retrieve data for both users. Please check the handles.");
        } else {
          setUsers(data.result);
        }
      } else {
        setError('No users found or error in fetching data.');
      }
    } catch (err) {
      setError('Error fetching user data.');
    }
    setLoading(false);
  };

  return (
    <div className="dashboard">
      <h2>Codeforces Visualizer Dashboard</h2>
      <p>Compare your statistics with your friend:</p>
      <div className="input-group">
        <input
          type="text"
          placeholder="Your Codeforces handle"
          value={yourHandle}
          onChange={(e) => setYourHandle(e.target.value)}
        />
        <input
          type="text"
          placeholder="Friend's Codeforces handle"
          value={friendHandle}
          onChange={(e) => setFriendHandle(e.target.value)}
        />
        <button onClick={handleCompare}>Compare</button>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {users.length === 2 && (
        <table>
          <thead>
            <tr>
              <th>Handle</th>
              <th>Rating</th>
              <th>Max Rating</th>
              <th>Rank</th>
              <th>Max Rank</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.handle}>
                <td>{user.handle}</td>
                <td>{user.rating || 'N/A'}</td>
                <td>{user.maxRating || 'N/A'}</td>
                <td>{user.rank || 'N/A'}</td>
                <td>{user.maxRank || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Dashboard;
