import React, { useState, useEffect } from 'react';
import { Table, Spinner, Alert, Button, ListGroup, Badge, Tabs, Tab, Form, InputGroup } from 'react-bootstrap';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

function ProblemRecommendations({ userHandle, userRating }) {

  // ── Tab 1: Rule-based weak topic state ──
  const [weakTopics, setWeakTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [ruleProblems, setRuleProblems] = useState([]);
  const [loading, setLoading] = useState(false);

  // ── Tab 2: Collaborative state ──
  const [collabProblems, setCollabProblems] = useState([]);
  const [similarUsers, setSimilarUsers] = useState([]);
  const [topWeakTags, setTopWeakTags] = useState([]);
  const [collabMeta, setCollabMeta] = useState(null);
  const [collabLoading, setCollabLoading] = useState(false);
  const [filteredByTopic, setFilteredByTopic] = useState(null);

  // ── Desired topic input ──
  const [topicInput, setTopicInput] = useState('');

  const [error, setError] = useState('');

  // ── On mount: fetch weak topics + trigger profile update in background ──
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

          const weakTopicsFiltered = Object.entries(problemStats)
            .filter(([tag, stats]) => {
              const total = stats.solved + stats.wrong;
              const successRate = stats.solved / total;
              return total >= 5 && successRate < 0.5;
            })
            .sort(([, a], [, b]) => {
              const scoreA = (a.wrong - a.solved) / (a.solved + a.wrong);
              const scoreB = (b.wrong - b.solved) / (b.solved + b.wrong);
              return scoreB - scoreA;
            })
            .map(([tag]) => tag);

          setWeakTopics(weakTopicsFiltered);

          // Background profile update for collaborative system
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

  // ── Tab 1: Fetch problems for a clicked weak topic ──
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

  // ── Tab 2: Fetch collaborative recommendations ──
  // Accepts optional topic override from topicInput
  const fetchCollaborative = (topicOverride = null) => {
    if (!userHandle) return;
    setCollabLoading(true);
    setError('');

    const topic = topicOverride !== null ? topicOverride : topicInput.trim();
    const url = topic
      ? `${API_URL}/api/recommendations/collaborative/${userHandle}?topic=${encodeURIComponent(topic)}`
      : `${API_URL}/api/recommendations/collaborative/${userHandle}`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCollabProblems(data.recommendations);
          setSimilarUsers(data.similarUsers || []);
          setTopWeakTags(data.topWeakTags || []);
          setCollabMeta(data.meta || null);
          setFilteredByTopic(data.filteredByTopic || null);
        } else {
          setError(data.message || 'Failed to fetch recommendations');
        }
      })
      .catch(() => setError('Failed to fetch collaborative recommendations.'))
      .finally(() => setCollabLoading(false));
  };

  // ── Clear topic and refetch with weak tags ──
  const clearTopicFilter = () => {
    setTopicInput('');
    fetchCollaborative('');
  };

  return (
    <div>
      <h2>Problem Recommendations</h2>
      {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}

      <Tabs defaultActiveKey="collab" className="mb-3">

        {/* ── Tab 1: Rule-based weak topic analysis ── */}
        <Tab eventKey="rule" title="Weak Topic Analysis">
          {loading && <Spinner animation="border" variant="primary" />}
          <h5 className="mt-2">Your Weak Topics</h5>
          {weakTopics.length > 0 ? (
            <ListGroup>
              {weakTopics.map((topic, i) => (
                <ListGroup.Item key={i} action onClick={() => fetchProblemsForTopic(topic)}
                  active={selectedTopic === topic}>
                  {topic}
                </ListGroup.Item>
              ))}
            </ListGroup>
          ) : (
            !loading && <p className="text-muted">No weak topics detected yet.</p>
          )}

          {selectedTopic && (
            <>
              <h5 className="mt-3">Problems for: <Badge bg="secondary">{selectedTopic}</Badge></h5>
              <Table striped bordered hover responsive>
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
                          target="_blank" rel="noopener noreferrer">View</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </Tab>

        {/* ── Tab 2: Enhanced collaborative recommendations ── */}
        <Tab eventKey="collab" title="Smart Recommendations">
          <p style={{ color: 'gray', fontSize: '0.9rem' }} className="mt-2">
            Ranked by your weak topics, what similar users solved, recent solving patterns, and rating range.
          </p>

          {/* Topic input — optional override */}
          <InputGroup className="mb-3" style={{ maxWidth: 480 }}>
            <Form.Control
              placeholder="Optional: enter a topic (e.g. greedy, dp, graphs)"
              value={topicInput}
              onChange={e => setTopicInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchCollaborative()}
            />
            {topicInput && (
              <Button variant="outline-secondary" onClick={clearTopicFilter}>
                ✕ Clear
              </Button>
            )}
          </InputGroup>

          <div className="d-flex gap-2 mb-3">
            <Button variant="dark" onClick={() => fetchCollaborative()} disabled={collabLoading}>
              {collabLoading
                ? <><Spinner animation="border" size="sm" className="me-1" />Loading...</>
                : topicInput ? `Get "${topicInput}" Problems` : 'Get Recommendations'}
            </Button>
          </div>

          {/* Active filter badge */}
          {filteredByTopic && (
            <p className="mb-2" style={{ fontSize: '0.9rem' }}>
              Showing problems for topic:{' '}
              <Badge bg="primary">{filteredByTopic}</Badge>{' '}
              <span style={{ cursor: 'pointer', color: 'gray', fontSize: '0.8rem' }}
                onClick={clearTopicFilter}>
                (clear to use weak topics)
              </span>
            </p>
          )}

          {/* Top weak tags summary */}
          {!filteredByTopic && topWeakTags.length > 0 && (
            <div className="mb-3">
              <span style={{ fontSize: '0.85rem', color: 'gray' }}>Your weakest topics: </span>
              {topWeakTags.map((t, i) => (
                <Badge
                  key={i}
                  bg="warning"
                  text="dark"
                  className="me-1"
                  style={{ cursor: 'pointer' }}
                  onClick={() => { setTopicInput(t.tag); fetchCollaborative(t.tag); }}
                  title={`Click to filter by ${t.tag}`}
                >
                  {t.tag} ({t.weaknessPercent}% weak)
                </Badge>
              ))}
            </div>
          )}

          {/* Similar users */}
          {similarUsers.length > 0 && (
            <p style={{ fontSize: '0.85rem', color: 'gray' }}>
              Based on users similar to you:{' '}
              {similarUsers.map((u, i) => (
                <Badge key={i} bg="secondary" className="me-1">{u}</Badge>
              ))}
            </p>
          )}

          {/* Meta info */}
          {collabMeta && (
            <p style={{ fontSize: '0.8rem', color: '#aaa' }}>
              Rating range: {collabMeta.ratingRange.min}–{collabMeta.ratingRange.max} •
              Your rating: {collabMeta.userRating} •
              {collabMeta.totalCandidates} candidates found
            </p>
          )}

          {/* Problems table */}
          {collabProblems.length > 0 && (
            <Table striped bordered hover responsive className="mt-2">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Problem</th>
                  <th>Rating</th>
                  <th>Tags</th>
                  <th>Why Recommended</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {collabProblems.map((p, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{p.name}</td>
                    <td>
                      <Badge bg={p.rating <= (collabMeta?.userRating || 1200) ? 'success' : 'warning'} text="dark">
                        {p.rating || 'N/A'}
                      </Badge>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{p.tags?.slice(0, 3).join(', ')}</td>
                    <td style={{ fontSize: '0.8rem', color: 'gray' }}>{p.reason}</td>
                    <td>
                      <a href={p.link} target="_blank" rel="noopener noreferrer">Solve →</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          {collabProblems.length === 0 && !collabLoading && (
            <p className="mt-3 text-muted">
              Click "Get Recommendations" above. More users on the platform = better collaborative results.
            </p>
          )}
        </Tab>

      </Tabs>
    </div>
  );
}

export default ProblemRecommendations;