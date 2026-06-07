import React, { useState, useEffect } from 'react';
import { Table, Spinner, Alert, Button, ListGroup, Badge, Tabs, Tab } from 'react-bootstrap';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function ProblemRecommendations({ userHandle, userRating }) {
  // ── Existing rule-based state ──
  const [weakTopics, setWeakTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [ruleProblems, setRuleProblems] = useState([]);

  // ── New collaborative state ──
  const [collabProblems, setCollabProblems] = useState([]);
  const [similarUsers, setSimilarUsers] = useState([]);
  const [collabLoading, setCollabLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Existing: fetch weak topics (rule-based) ──
  useEffect(() => {
    if (!userHandle) return;
    setLoading(true);

    fetch(`https://codeforces.com/api/user.status?handle=${userHandle}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'OK') {
          const problemStats = {};
          data.result.forEach(submission => {
            if (!submission.problem.tags) return;
            submission.problem.tags.forEach(tag => {
              if (!problemStats[tag]) problemStats[tag] = { solved: 0, wrong: 0 };
              if (submission.verdict === 'OK') problemStats[tag].solved++;
              else problemStats[tag].wrong++;
            });
          });

          // Improved: ratio-based instead of fixed threshold
          const weakTopicsFiltered = Object.entries(problemStats)
            .filter(([tag, stats]) => {
              const total = stats.solved + stats.wrong;
              const successRate = stats.solved / total;
              return total >= 5 && successRate < 0.5;
            })
            .sort(([, a], [, b]) => {
              // Sort by weakness score (most weak first)
              const scoreA = (a.wrong - a.solved) / (a.solved + a.wrong);
              const scoreB = (b.wrong - b.solved) / (b.solved + b.wrong);
              return scoreB - scoreA;
            })
            .map(([tag]) => tag);

          setWeakTopics(weakTopicsFiltered);

          // Update user profile in background for collaborative filtering
          fetch(`${API_URL}/api/recommendations/update-profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: userHandle })
          });
        }
      })
      .catch(() => setError('Failed to fetch submission data.'))
      .finally(() => setLoading(false));
  }, [userHandle]);

  // ── Existing: fetch problems for a weak topic ──
  const fetchProblemsForTopic = (topic) => {
    if (!userRating) return;
    setLoading(true);

    fetch('https://codeforces.com/api/problemset.problems')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'OK') {
          const filtered = data.result.problems
            .filter(p =>
              p.tags.includes(topic) &&
              p.rating >= userRating &&
              p.rating <= userRating + 300
            )
            .slice(0, 20);
          setRuleProblems(filtered);
          setSelectedTopic(topic);
        }
      })
      .catch(() => setError('Failed to fetch problems.'))
      .finally(() => setLoading(false));
  };

  // ── New: fetch collaborative recommendations ──
  const fetchCollaborative = () => {
    if (!userHandle) return;
    setCollabLoading(true);

    fetch(`${API_URL}/api/recommendations/collaborative/${userHandle}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCollabProblems(data.recommendations);
          setSimilarUsers(data.similarUsers || []);
        } else {
          setError(data.message || 'Failed to fetch recommendations');
        }
      })
      .catch(() => setError('Failed to fetch collaborative recommendations.'))
      .finally(() => setCollabLoading(false));
  };

  return (
    <div>
      <h2>Problem Recommendations</h2>
      {error && <Alert variant="danger">{error}</Alert>}

      <Tabs defaultActiveKey="rule" className="mb-3">

        {/* ── Tab 1: Existing rule-based ── */}
        <Tab eventKey="rule" title="Weak Topic Analysis">
          {loading && <Spinner animation="border" variant="primary" />}
          <h5>Your Weak Topics</h5>
          {weakTopics.length > 0 ? (
            <ListGroup>
              {weakTopics.map((topic, i) => (
                <ListGroup.Item key={i}>
                  <Button variant="link" onClick={() => fetchProblemsForTopic(topic)}>
                    {topic}
                  </Button>
                </ListGroup.Item>
              ))}
            </ListGroup>
          ) : (
            <p>No weak topics detected.</p>
          )}

          {selectedTopic && (
            <>
              <h5 className="mt-3">Problems for: {selectedTopic}</h5>
              <Table striped bordered hover>
                <thead>
                  <tr><th>Problem</th><th>Rating</th><th>Link</th></tr>
                </thead>
                <tbody>
                  {ruleProblems.map((p, i) => (
                    <tr key={i}>
                      <td>{p.name}</td>
                      <td>{p.rating || 'N/A'}</td>
                      <td>
                        <a href={`https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`}
                          target="_blank" rel="noopener noreferrer">
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </Tab>

        {/* ── Tab 2: New collaborative ── */}
        <Tab eventKey="collab" title="Recommended by Similar Users">
          <p style={{ color: 'gray', fontSize: '0.9rem' }}>
            Finds users with similar solving patterns and recommends problems they solved that you haven't.
          </p>
          <Button variant="dark" onClick={fetchCollaborative} disabled={collabLoading}>
            {collabLoading ? <Spinner animation="border" size="sm" /> : 'Get Recommendations'}
          </Button>

          {similarUsers.length > 0 && (
            <p className="mt-2" style={{ fontSize: '0.85rem', color: 'gray' }}>
              Based on users similar to you:{' '}
              {similarUsers.map((u, i) => (
                <Badge key={i} bg="secondary" className="me-1">{u}</Badge>
              ))}
            </p>
          )}

          {collabProblems.length > 0 && (
            <Table striped bordered hover className="mt-3">
              <thead>
                <tr><th>Problem</th><th>Rating</th><th>Tags</th><th>Link</th></tr>
              </thead>
              <tbody>
                {collabProblems.map((p, i) => (
                  <tr key={i}>
                    <td>{p.name}</td>
                    <td>{p.rating || 'N/A'}</td>
                    <td>{p.tags?.slice(0, 3).join(', ')}</td>
                    <td><a href={p.link} target="_blank" rel="noopener noreferrer">View</a></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          {collabProblems.length === 0 && !collabLoading && (
            <p className="mt-3 text-muted">
              Click the button above. More users on the platform = better recommendations.
            </p>
          )}
        </Tab>

      </Tabs>
    </div>
  );
}

export default ProblemRecommendations;