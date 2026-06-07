import React, { useState, useEffect } from 'react';
import { Form, Button, Alert, Spinner, ListGroup } from 'react-bootstrap';
import axios from 'axios';
import './contestpage.css'; // Reusing the contestpage CSS for consistent styling
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function TeamsPage() {
  // Get the current user's CodeForces handle from localStorage
  const currentUser = localStorage.getItem('myHandle');

  const [teamName, setTeamName] = useState('');
  // The members state now represents only additional members (other than the logged-in user)
  const [members, setMembers] = useState(['']);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);

  // Limit additional members to 2 (since the logged-in user is automatically included)
  const addMemberField = () => {
    if (members.length < 2) {
      setMembers([...members, '']);
    }
  };

  const removeMemberField = (index) => {
    const newMembers = members.filter((_, i) => i !== index);
    setMembers(newMembers);
  };

  const handleMemberChange = (index, value) => {
    const newMembers = [...members];
    newMembers[index] = value;
    setMembers(newMembers);
  };

  // Create team handler: ensures currentUser is included in the team members.
  const createTeam = async () => {
    setError('');
    setMessage('');

    // Block team creation if no user is logged in
    if (!currentUser) {
      setError('You must be logged in to create a team.');
      return;
    }

    // Filter out empty strings from additional members input
    const additionalMembers = members.filter(m => m.trim() !== '');

    // Validate the team name
    if (!teamName.trim()) {
      setError('Team name is required.');
      return;
    }

    // Remove any duplicate if user already entered his/her own handle
    const filteredAdditional = additionalMembers.filter(m => m !== currentUser);

    // Combine the current user's handle with the additional members
    const teamMembers = [currentUser, ...filteredAdditional];

    // Optionally, you can validate the total number of team members
    if (teamMembers.length < 1 || teamMembers.length > 3) {
      setError('Total team members must be between 1 and 3 (including yourself).');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/teams/create`, { teamName, members: teamMembers });
      if (res.data.success) {
        setMessage('Team created successfully.');
        setTeamName('');
        setMembers(['']);
        fetchTeams();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error creating team.');
    }
    setLoading(false);
  };

  // Fetch all teams from the backend
  const fetchTeams = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/teams`);
      if (res.data.success) {
        setTeams(res.data.teams);
      }
    } catch (err) {
      console.error('Error fetching teams', err);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  // Filter teams where the current user is a member
  const myTeams = teams.filter(team => currentUser && team.members.includes(currentUser));

  return (
    <div className="contest-page">
      <h2 className="page-heading">Teams</h2>
      {error && <Alert variant="danger">{error}</Alert>}
      {message && <Alert variant="dark">{message}</Alert>}
      
      <div className="mb-4">
        <h4>Create a New Team</h4>
        <Form className="contest-form">
          <Form.Group className="mb-3">
            <Form.Label>Team Name</Form.Label>
            <Form.Control
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </Form.Group>
          
          <Form.Text className="text-muted mb-3 d-block">
            Your CodeForces handle: <strong>{currentUser || 'Not logged in'}</strong>
          </Form.Text>
          
          <Form.Label className="mt-3">Additional Team Members (Codeforces IDs)</Form.Label>
          {members.map((member, index) => (
            <Form.Group className="mb-3" key={index}>
              <div className="d-flex">
                <Form.Control
                  type="text"
                  placeholder="Enter member Codeforces ID"
                  value={member}
                  onChange={(e) => handleMemberChange(index, e.target.value)}
                  className="me-2"
                />
                {members.length > 1 && (
                  <Button 
                    variant="danger" 
                    size="sm" 
                    onClick={() => removeMemberField(index)}
                    className="small-btn"
                  >
                    Remove
                  </Button>
                )}
              </div>
            </Form.Group>
          ))}
          
          {members.length < 2 && (
            <Button variant="dark" size="sm" onClick={addMemberField} className="mb-3">
              Add Member
            </Button>
          )}
          
          <Button 
            className="full-btn" 
            variant="dark" 
            onClick={createTeam} 
            disabled={loading}
          >
            {loading ? <Spinner animation="border" size="sm" variant="light" /> : 'Create Team'}
          </Button>
        </Form>
      </div>
      
      {currentUser && (
        <div className="mt-4">
          <h4>My Teams</h4>
          {myTeams.length > 0 ? (
            <ListGroup className="mb-3">
              {myTeams.map(team => (
                <ListGroup.Item key={team._id} className="contest-list-item">
                  <div>
                    <strong>{team.teamName}</strong>
                    <div className="text-muted">Members: {team.members.join(', ')}</div>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          ) : (
            <Alert variant="info">You are not a member of any team yet.</Alert>
          )}
        </div>
      )}
    </div>
  );
}

export default TeamsPage;