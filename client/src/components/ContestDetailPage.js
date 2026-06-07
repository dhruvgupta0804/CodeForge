import React, { useState, useEffect } from 'react';
import { Alert, Spinner, Table, Button, Card, Row, Col, Toast } from 'react-bootstrap';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

function ContestDetailPage() {
  const { contestSlug } = useParams();
  const navigate = useNavigate(); // Add navigation hook
  const [contest, setContest] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [problemDetails, setProblemDetails] = useState({});
  const [showCopiedToast, setShowCopiedToast] = useState(false);

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001'

  const fetchContest = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/contests/slug/${contestSlug}`);
      if (res.data.success) {
        setContest(res.data.contest);
        fetchProblemDetails(res.data.contest.problems);
        console.log(res.data.contest.problems);
      } else {
        setError('Contest not found');
      }
    } catch (err) {
      setError('Error fetching contest');
    }
    setLoading(false);
  };

  const fetchProblemDetails = async (problems) => {
    const problemDetailsMap = {};
    for (const prob of problems) {
      try {
        const problemRes = await axios.get(
          `https://codeforces.com/api/contest.standings?contestId=${prob.contestId}&from=1&count=1`
        );
        if (problemRes.data.status === 'OK') {
          const found = problemRes.data.result.problems.find(p => p.index === prob.problemIndex);
          if (found) problemDetailsMap[`${prob.contestId}-${prob.problemIndex}`] = found;
        }
        if (problemRes.data.status === 'OK') {
          problemDetailsMap[`${prob.contestId}-${prob.problemIndex}`] = problemRes.data.result[0];
        }
      } catch (err) {
        console.error(`Error fetching problem details for ${prob.problemIndex}:`, err);
      }
    }
    setProblemDetails(problemDetailsMap);
  };

  const handleProblemClick = (problem, problemDetail) => {
    // If a direct contest link is available, use that
    if (problem.contestLink) {
      window.open(problem.contestLink, '_blank', 'noopener,noreferrer');
      return;
    }

    // If problem detail is available, construct Codeforces problem URL
    if (problemDetail) {
      const problemUrl = `https://codeforces.com/contest/${problemDetail.contestId}/problem/${problemDetail.index}`;
      window.open(problemUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // Fallback: navigate to a general problem page if needed
    // This is just an example - adjust the route as per your application's routing
    navigate(`/problems/${problem.contestId}/${problem.problemIndex}`);
  };

  const refreshLeaderboard = async () => {
    if (!contest) return;
    const newLeaderboard = [];

    for (const participant of contest.participants) {
      let allSubs = [];
      let displayName = '';
      if (participant.isTeam) {
        displayName = `${participant.teamName} (${(participant.members || []).join(', ')})`;
        for (const member of participant.members) {
          try {
            const subRes = await axios.get(`https://codeforces.com/api/user.status?handle=${member}&count=50`);
            const submissions = subRes.data.result || [];
            allSubs = allSubs.concat(submissions);
          } catch (err) {
            console.error(`Error fetching submissions for team member ${member}:`, err);
          }
        }
      } else {
        displayName = participant.username;
        try {
          const subRes = await axios.get(
            `https://codeforces.com/api/user.status?handle=${participant.username}&count=50`
          );
          const submissions = subRes.data.result || [];
          allSubs = submissions;
        } catch (err) {
          console.error(`Error fetching submissions for ${participant.username}:`, err);
        }
      }

      let solvedCount = 0;
      let totalPenalty = 0;
      const problemStatus = {};

      try {
        for (const prob of contest.problems) {
          const problemKey = `${prob.contestId}-${prob.problemIndex}`;

          const relevantSubs = allSubs.filter(sub =>
            sub.problem &&
            sub.problem.index === prob.problemIndex &&
            sub.problem.contestId &&
            sub.problem.contestId.toString() === prob.contestId.toString() &&
            new Date(sub.creationTimeSeconds * 1000) >= new Date(contest.startTime)
          );

          const acceptedSubs = relevantSubs.filter(sub =>
            sub.verdict === 'OK' &&
            sub.problem.index === prob.problemIndex &&
            sub.problem.contestId.toString() === prob.contestId.toString()
          );

          if (acceptedSubs.length > 0) {
            acceptedSubs.sort((a, b) => a.creationTimeSeconds - b.creationTimeSeconds);
            const firstAccepted = acceptedSubs[0];

            const solvedTime = Math.floor(
              (firstAccepted.creationTimeSeconds * 1000 - new Date(contest.startTime).getTime()) / 60000
            );

            const wrongAttempts = relevantSubs.filter(
              sub => sub.creationTimeSeconds < firstAccepted.creationTimeSeconds &&
                sub.verdict !== 'OK' &&
                sub.problem.index === prob.problemIndex &&
                sub.problem.contestId.toString() === prob.contestId.toString()
            ).length;

            problemStatus[problemKey] = {
              solved: true,
              attempts: wrongAttempts,
              time: solvedTime
            };
            solvedCount += 1;
            totalPenalty += solvedTime + wrongAttempts * 20;
          } else if (relevantSubs.filter(sub => sub.verdict !== 'OK').length > 0) {
            problemStatus[problemKey] = {
              solved: false,
              attempts: relevantSubs.filter(sub => sub.verdict !== 'OK').length,
              time: 0
            };
          }
        }
      } catch (err) {
        console.error('Error computing scoreboard for participant:', err);
      }

      newLeaderboard.push({
        displayName,
        solvedCount,
        penalty: totalPenalty,
        problemStatus,
      });
    }

    newLeaderboard.sort((a, b) => {
      if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount;
      return a.penalty - b.penalty;
    });

    setLeaderboard(newLeaderboard);
  };

  useEffect(() => {
    fetchContest();
  }, [contestSlug]);

  const calculateEndTime = () => {
    if (!contest) return null;
    const startTime = new Date(contest.startTime);
    return new Date(startTime.getTime() + contest.duration * 60000);
  };

  // Method to extract contest code from slug
  const getContestCode = () => {
    const parts = contestSlug.split('-');
    console.log(parts);
    return parts[1];
  };

  const handleContestCodeCopy = () => {
    const contestCode = getContestCode();
    navigator.clipboard.writeText(contestCode)
      .then(() => {
        setShowCopiedToast(true);
        setTimeout(() => setShowCopiedToast(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy contest code:', err);
      });
  };

  if (loading) return <Spinner animation="border" variant="dark" />;
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!contest) return null;

  const contestStarted = new Date() >= new Date(contest.startTime);
  const endTime = calculateEndTime();

  return (
    <div
      className="container-fluid p-3"
      style={{ fontFamily: "'Roboto Mono', monospace" }}
    >
      {/* Toast for copy confirmation */}
      <Toast
        onClose={() => setShowCopiedToast(false)}
        show={showCopiedToast}
        delay={2000}
        autohide
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          zIndex: 1000
        }}
      >
        <Toast.Header>
          <strong className="mr-auto">Copied!</strong>
        </Toast.Header>
        <Toast.Body>Contest code copied to clipboard</Toast.Body>
      </Toast>

      <Card className="mb-3 shadow-sm">
        <Card.Header
          as="h2"
          className="bg-dark text-white py-2 d-flex justify-content-between align-items-center"
          style={{
            fontFamily: "'Roboto Mono', monospace",
            position: 'relative'
          }}
        >
          <div>{contest.name}</div>
          <div
            onClick={handleContestCodeCopy}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(255,255,255,0.2)',
              padding: '5px 10px',
              borderRadius: '4px',
              fontSize: '20px',
              cursor: 'pointer', // Add pointer cursor to indicate it's clickable
              transition: 'background-color 0.3s ease' // Smooth transition for hover effect
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = 'rgba(255,255,255,0.4)';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = 'rgba(255,255,255,0.2)';
            }}
          >
            Contest Code:
            {getContestCode()}
          </div>
        </Card.Header>
        <Card.Body className="py-2" style={{ fontFamily: "'Roboto Mono', monospace" }}>
          <Row>
            <Col md={4} className="py-1">
              <strong>Start Time:</strong> {new Date(contest.startTime).toLocaleString()}
            </Col>
            <Col md={4} className="py-1">
              <strong>End Time:</strong> {endTime ? endTime.toLocaleString() : 'N/A'}
            </Col>
            <Col md={4} className="py-1">
              <strong>Duration:</strong> {contest.duration} minutes
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {!contestStarted ? (
        <Alert variant="secondary" style={{ fontFamily: "'Roboto Mono', monospace" }}>
          Contest has not started yet.
        </Alert>
      ) : (
        <>
          <Card className="mb-3 shadow-sm">
            <Card.Header as="h3" className="py-2" style={{ fontFamily: "'Roboto Mono', monospace" }}>Problems</Card.Header>
            <Card.Body className="py-2">
              {contest.problems.map((p, idx) => {
                const alphabet = String.fromCharCode(65 + idx);
                const problemKey = `${p.contestId}-${p.problemIndex}`;
                const problemDetail = problemDetails[problemKey];

                return (
                  <Card key={idx} className="mb-2">
                    <Card.Body className="d-flex align-items-center p-2">
                      <div className="mr-3 d-flex align-items-center">
                        <Button
                          variant="outline-dark"
                          className="mr-3"
                          style={{
                            width: '50px',
                            height: '50px',
                            marginRight: '10px',
                            cursor: 'pointer' // Add cursor pointer to indicate clickability
                          }}
                          onClick={() => handleProblemClick(p, problemDetail)}
                        >
                          {alphabet}
                        </Button>
                      </div>
                      <div className="ml-3">
                        <h5
                          className="mb-1 text-dark"
                          style={{
                            cursor: 'pointer',
                            textDecoration: 'none'
                          }}
                          onClick={() => handleProblemClick(p, problemDetail)}
                        >
                          {problemDetail
                            ? problemDetail.name
                            : `Problem ${alphabet}`}
                        </h5>
                      </div>
                    </Card.Body>
                  </Card>
                );
              })}
            </Card.Body>
          </Card>

          <Card className="mb-3 shadow-sm">
            <Card.Header as="h3" className="py-2" style={{ fontFamily: "'Roboto Mono', monospace" }}>Standings</Card.Header>
            <Card.Body className="py-2">
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Who</th>
                    {contest.problems.map((p, idx) => {
                      const alphabet = String.fromCharCode(65 + idx);
                      return <th key={idx}>{alphabet}</th>;
                    })}
                    <th>=</th>
                    <th>Penalty</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.length > 0 ? (
                    leaderboard.map((row, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{row.displayName}</td>
                        {contest.problems.map((p, problemIdx) => {
                          const alphabet = String.fromCharCode(65 + problemIdx);
                          const problemKey = `${p.contestId}-${p.problemIndex}`;
                          const status = row.problemStatus?.[problemKey];

                          if (!status) {
                            return <td key={problemIdx} className="text-muted">.</td>;
                          }

                          if (status.solved) {
                            return (
                              <td
                                key={problemIdx}
                                className="bg-success text-white"
                                title={`+${status.attempts > 0 ? status.attempts : ''}`}
                              >
                                {alphabet}
                                {status.attempts > 0 && <sup>{status.attempts}</sup>}
                              </td>
                            );
                          }

                          if (status.attempts > 0) {
                            return (
                              <td
                                key={problemIdx}
                                className="bg-danger text-white"
                                title={`-${status.attempts}`}
                              >
                                {alphabet}
                                <sup>{status.attempts}</sup>
                              </td>
                            );
                          }

                          return <td key={problemIdx} className="text-muted">.</td>;
                        })}
                        <td>{row.solvedCount}</td>
                        <td>{row.penalty}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={contest.problems.length + 4} className="text-center">
                        No submissions yet. Click "Refresh Standings" to update.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
              <div className="text-center">
                <Button
                  variant="outline-dark"
                  onClick={refreshLeaderboard}
                  style={{ fontFamily: "'Roboto Mono', monospace" }}
                >
                  Refresh Standings
                </Button>
              </div>
            </Card.Body>
          </Card>
        </>
      )}
    </div>
  );
}

export default ContestDetailPage;