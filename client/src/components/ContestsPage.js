// src/components/ContestsPage.js
import React, { useState, useEffect } from 'react';
import { Table, Spinner, Alert, Form, Row, Col, Button } from 'react-bootstrap';

function ContestsPage() {
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterPhase, setFilterPhase] = useState('ALL');

  // Fetch contests from Codeforces API on mount.
  useEffect(() => {
    setLoading(true);
    fetch('https://codeforces.com/api/contest.list?gym=false')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'OK') {
          // Sort contests by start time (newest first)
          const sortedContests = data.result.sort((a, b) => b.startTimeSeconds - a.startTimeSeconds);
          setContests(sortedContests);
        } else {
          setError('Error fetching contests data.');
        }
      })
      .catch(() => setError('Error fetching contests data.'))
      .finally(() => setLoading(false));
  }, []);

  // Filter contests based on phase.
  const getFilteredContests = () => {
    if (filterPhase === 'ALL') return contests;
    return contests.filter((contest) => contest.phase === filterPhase);
  };

  return (
    <div className="contests-page" style={{ padding: '20px' }}>
      {/* Added top margin to create spacing between nav bar and heading */}
      <h1 style={{ marginTop: '20px' }}>CodeForces Contests</h1>
      
      <Row className="mb-3">
        <Col md={4}>
          <Form.Group controlId="phaseSelect">
            <Form.Label>Filter by Phase:</Form.Label>
            <Form.Control
              as="select"
              value={filterPhase}
              onChange={(e) => setFilterPhase(e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="BEFORE">Before</option>
              <option value="CODING">Coding</option>
              <option value="FINISHED">Finished</option>
            </Form.Control>
          </Form.Group>
        </Col>
      </Row>
      
      {/* Gray gradient underline below filter dropdown */}
      <div
        className="filter-underline"
        style={{
          height: '4px',
          background: 'linear-gradient(to right, #ccc, #888)',
          margin: '0.5rem 0 1rem 0'
        }}
      ></div>

      {loading && (
        <div className="text-center my-3">
          <Spinner animation="border" variant="primary" />
        </div>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
      {!loading && !error && (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Contest ID</th>
              <th>Name</th>
              <th>Phase</th>
              <th>Duration (min)</th>
              <th>Start Time</th>
            </tr>
          </thead>
          <tbody>
            {getFilteredContests().map((contest) => (
              <tr key={contest.id || contest.contestId}>
                <td>{contest.id || contest.contestId}</td>
                <td>
                  <a
                    href={`https://codeforces.com/contest/${contest.id || contest.contestId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {contest.name}
                  </a>
                </td>
                <td>{contest.phase}</td>
                <td>{Math.floor(contest.durationSeconds / 60)}</td>
                <td>
                  {contest.startTimeSeconds
                    ? new Date(contest.startTimeSeconds * 1000).toLocaleString()
                    : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

export default ContestsPage;
