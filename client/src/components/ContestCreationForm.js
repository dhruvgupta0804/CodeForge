// src/components/ContestCreationForm.js
import React, { useState } from 'react';
import { Form, Button, Alert, Spinner, Card } from 'react-bootstrap';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function ContestCreationForm() {
  const [title, setTitle] = useState('');
  const [problems, setProblems] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!title.trim() || !problems.trim()) {
      setError('Please fill out all fields.');
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post('/contests/create', { title, problems });
      if (response.data.success) {
        setSuccessMsg('Contest created successfully!');
        // Optionally, navigate to profile or clear form fields.
        setTitle('');
        setProblems('');
        // navigate('/profile');
      } else {
        setError('Failed to create contest.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error creating contest.');
    }
    setLoading(false);
  };

  return (
    <Card className="p-3 m-3">
      <h3>Create a New Contest</h3>
      {error && <Alert variant="danger">{error}</Alert>}
      {successMsg && <Alert variant="success">{successMsg}</Alert>}
      <Form onSubmit={handleSubmit}>
        <Form.Group controlId="contestTitle" className="mb-3">
          <Form.Label>Contest Title</Form.Label>
          <Form.Control
            type="text"
            placeholder="Enter contest title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Form.Group>
        <Form.Group controlId="contestProblems" className="mb-3">
          <Form.Label>Problem IDs (comma separated)</Form.Label>
          <Form.Control
            type="text"
            placeholder="e.g. 123A, 456B"
            value={problems}
            onChange={(e) => setProblems(e.target.value)}
          />
        </Form.Group>
        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? <Spinner animation="border" size="sm" /> : 'Create Contest'}
        </Button>
      </Form>
    </Card>
  );
}

export default ContestCreationForm;
