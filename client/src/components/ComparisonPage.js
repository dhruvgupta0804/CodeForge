// src/FriendComparisonPage.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Table,
  Button,
  Form,
  Alert,
  Spinner,
  Card,
} from 'react-bootstrap';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

function FriendComparisonPage() {
  const { friendHandle } = useParams();
  const [myHandle, setMyHandle] = useState(localStorage.getItem('myHandle') || '');
  const [inputMyHandle, setInputMyHandle] = useState('');
  const [commonContests, setCommonContests] = useState([]);
  const [comparisonData, setComparisonData] = useState([]);
  const [ratingProgressionData, setRatingProgressionData] = useState([]);
  const [ratingDistComparison, setRatingDistComparison] = useState([]);
  const [tagDistComparison, setTagDistComparison] = useState([]);
  const [myRatingStats, setMyRatingStats] = useState(null);
  const [friendRatingStats, setFriendRatingStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [extraLoading, setExtraLoading] = useState(false);

  // Helper: Compute rating statistics (max increase, max decrease, average delta)
  const computeRatingStats = (ratingHistory) => {
    if (!ratingHistory || ratingHistory.length === 0) return null;
    let maxIncrease = -Infinity;
    let maxDecrease = Infinity;
    let totalDelta = 0;
    ratingHistory.forEach(contest => {
      const delta = contest.newRating - contest.oldRating;
      if (delta > maxIncrease) maxIncrease = delta;
      if (delta < maxDecrease) maxDecrease = delta;
      totalDelta += delta;
    });
    const averageDelta = totalDelta / ratingHistory.length;
    return { maxIncrease, maxDecrease, averageDelta };
  };

  // Fetch rating histories and build common contest data & rating progression.
  const fetchComparisonData = async () => {
    if (!myHandle) {
      setError('Please set your handle.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const [myRatingRes, friendRatingRes] = await Promise.all([
        fetch(`https://codeforces.com/api/user.rating?handle=${myHandle.trim()}`),
        fetch(`https://codeforces.com/api/user.rating?handle=${friendHandle.trim()}`)
      ]);
      const myRatingData = await myRatingRes.json();
      const friendRatingData = await friendRatingRes.json();

      if (myRatingData.status !== 'OK' || friendRatingData.status !== 'OK') {
        throw new Error('Error fetching rating data.');
      }

      const myHistory = myRatingData.result;
      const friendHistory = friendRatingData.result;
      
      setMyRatingStats(computeRatingStats(myHistory));
      setFriendRatingStats(computeRatingStats(friendHistory));

      // Build common contests (by contestId)
      const myContests = myHistory.reduce((acc, contest) => {
        acc[contest.contestId] = contest;
        return acc;
      }, {});
      const friendContests = friendHistory.reduce((acc, contest) => {
        acc[contest.contestId] = contest;
        return acc;
      }, {});
      const commonIds = Object.keys(myContests).filter(id => friendContests[id]);
      const commonData = commonIds.map(id => ({
        contestId: id,
        contestName: myContests[id].contestName,
        myRank: myContests[id].rank,
        friendRank: friendContests[id].rank,
        myRating: myContests[id].newRating,
        friendRating: friendContests[id].newRating,
      }));
      commonData.sort((a, b) => parseInt(a.contestId) - parseInt(b.contestId));
      setCommonContests(commonData);
      // For rating progression chart.
      setRatingProgressionData(commonData);
      // For rank comparison table.
      const chartData = commonData.map(contest => ({
        contestName: contest.contestName,
        myRank: contest.myRank,
        friendRank: contest.friendRank,
      }));
      setComparisonData(chartData);
    } catch (err) {
      setError(err.message || 'Error comparing data.');
    }
    setLoading(false);
  };

  // Fetch submissions and compute rating distribution (problems solved by problem rating).
  const fetchRatingDistData = async () => {
    if (!myHandle || !friendHandle) return;
    setExtraLoading(true);
    try {
      const [myStatusRes, friendStatusRes] = await Promise.all([
        fetch(`https://codeforces.com/api/user.status?handle=${myHandle.trim()}&from=1&count=10000`),
        fetch(`https://codeforces.com/api/user.status?handle=${friendHandle.trim()}&from=1&count=10000`)
      ]);
      const myStatusData = await myStatusRes.json();
      const friendStatusData = await friendStatusRes.json();
      if (myStatusData.status !== "OK" || friendStatusData.status !== "OK") {
        throw new Error("Error fetching submission data.");
      }
      // Helper: Get rating distribution from submissions.
      const getRatingDistribution = (submissions) => {
        const map = {};
        submissions.forEach(sub => {
          if (sub.verdict === "OK" && sub.problem && sub.problem.rating) {
            const rating = sub.problem.rating;
            map[rating] = (map[rating] || 0) + 1;
          }
        });
        return map;
      };
      const myRatingDistMap = getRatingDistribution(myStatusData.result);
      const friendRatingDistMap = getRatingDistribution(friendStatusData.result);
      const ratingKeys = Array.from(new Set([...Object.keys(myRatingDistMap), ...Object.keys(friendRatingDistMap)]));
      const ratingDistData = [];
      ratingKeys.forEach(rating => {
        ratingDistData.push({
          rating: parseInt(rating),
          mySolved: myRatingDistMap[rating] || 0,
          friendSolved: friendRatingDistMap[rating] || 0,
        });
      });
      ratingDistData.sort((a, b) => a.rating - b.rating);
      setRatingDistComparison(ratingDistData);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error comparing rating distribution data.");
    }
    setExtraLoading(false);
  };

  // Fetch submissions and compute tag distribution (problems solved by tags).
  const fetchTagComparisonData = async () => {
    if (!myHandle || !friendHandle) return;
    try {
      const [myStatusRes, friendStatusRes] = await Promise.all([
        fetch(`https://codeforces.com/api/user.status?handle=${myHandle.trim()}&from=1&count=10000`),
        fetch(`https://codeforces.com/api/user.status?handle=${friendHandle.trim()}&from=1&count=10000`)
      ]);
      const myStatusData = await myStatusRes.json();
      const friendStatusData = await friendStatusRes.json();
      if (myStatusData.status !== "OK" || friendStatusData.status !== "OK") {
        throw new Error("Error fetching submission data for tags.");
      }
      // Helper: Get tag distribution from submissions.
      const getTagDistribution = (submissions) => {
        const map = {};
        submissions.forEach(sub => {
          if (sub.verdict === "OK" && sub.problem && sub.problem.tags) {
            sub.problem.tags.forEach(tag => {
              map[tag] = (map[tag] || 0) + 1;
            });
          }
        });
        return map;
      };
      const myTagMap = getTagDistribution(myStatusData.result);
      const friendTagMap = getTagDistribution(friendStatusData.result);
      const tagKeys = Array.from(new Set([...Object.keys(myTagMap), ...Object.keys(friendTagMap)]));
      const tagData = [];
      tagKeys.forEach(tag => {
        tagData.push({
          tag,
          mySolved: myTagMap[tag] || 0,
          friendSolved: friendTagMap[tag] || 0,
        });
      });
      // Sort by total solved in descending order.
      tagData.sort((a, b) => (b.mySolved + b.friendSolved) - (a.mySolved + a.friendSolved));
      setTagDistComparison(tagData);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error comparing tag data.");
    }
  };

  // Prompt to set your handle.
  const handleMyHandleSubmit = () => {
    if (!inputMyHandle.trim()) {
      setError('Please enter your handle.');
      return;
    }
    setMyHandle(inputMyHandle.trim());
    localStorage.setItem('myHandle', inputMyHandle.trim());
  };

  useEffect(() => {
    if (myHandle) {
      fetchComparisonData();
    }
  }, [myHandle, friendHandle]);

  useEffect(() => {
    if (myHandle && friendHandle) {
      fetchRatingDistData();
      fetchTagComparisonData();
    }
  }, [myHandle, friendHandle]);

  return (
    <Container
      className="mt-4"
      style={{
        fontFamily: 'Roboto Mono',
        color: '#000',
        backgroundColor: '#fff',
        padding: '2rem',
      }}
    >
      <h2 className="text-center mb-4">Comparison with {friendHandle}</h2>
      {error && <Alert variant="danger">{error}</Alert>}
      {!myHandle && (
        <div className="mb-3 text-center">
          <Form.Group>
            <Form.Control
              type="text"
              placeholder="Enter your Codeforces handle"
              value={inputMyHandle}
              onChange={(e) => setInputMyHandle(e.target.value)}
            />
          </Form.Group>
          <Button variant="primary" onClick={handleMyHandleSubmit} className="mt-2">
            Set My Handle
          </Button>
        </div>
      )}
      {loading && (
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
        </div>
      )}
      <Card className="mt-4" style={{ boxShadow: '0 4px 8px rgba(0,0,0,0.1)', border: '1px solid #ccc' }}>
            <Card.Body>
              <h4 className="text-center mb-3">Rank Comparison Chart</h4>
              <div style={{ width: '100%', height: '400px', margin: '0 auto' }}>
                <ResponsiveContainer>
                  <LineChart
                    data={comparisonData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                    <XAxis dataKey="contestName" stroke="#000" />
                    <YAxis reversed={true} stroke="#000" />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #000' }} />
                    <Legend />
                    <Line type="monotone" dataKey="myRank" stroke="#0057e7" strokeWidth={2} />
                    <Line type="monotone" dataKey="friendRank" stroke="#d62d20" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
      {/* Section 1: Rating Progression Comparison */}
      {ratingProgressionData.length > 0 && (
        <Card className="mt-4" style={{ boxShadow: '0 4px 8px rgba(0,0,0,0.1)', border: '1px solid #ccc' }}>
          <Card.Body>
            <h4 className="text-center mb-3">Rating Progression Comparison</h4>
            <div style={{ width: '100%', height: '400px', margin: '0 auto' }}>
              <ResponsiveContainer>
                <LineChart
                  data={ratingProgressionData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                  <XAxis dataKey="contestName" stroke="#000" />
                  <YAxis stroke="#000" />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #000' }} />
                  <Legend />
                  <Line type="monotone" dataKey="myRating" stroke="#0057e7" strokeWidth={2} name="Your Rating" />
                  <Line type="monotone" dataKey="friendRating" stroke="#d62d20" strokeWidth={2} name={`${friendHandle}'s Rating`} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Section 2: Problems Solved by Problem Rating Comparison */}
      <h4 className="text-center mt-4">Problems Solved by Problem Rating</h4>
      {extraLoading ? (
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : ratingDistComparison.length > 0 ? (
        <Card className="mt-3" style={{ boxShadow: '0 4px 8px rgba(0,0,0,0.1)', border: '1px solid #ccc' }}>
          <Card.Body>
            <div style={{ width: '100%', height: '400px', margin: '0 auto' }}>
              <ResponsiveContainer>
                <BarChart
                  data={ratingDistComparison}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                  <XAxis dataKey="rating" stroke="#000" />
                  <YAxis stroke="#000" />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #000' }} />
                  <Legend />
                  <Bar dataKey="mySolved" fill="#0057e7" name="Your Solved" />
                  <Bar dataKey="friendSolved" fill="#d62d20" name={`${friendHandle}'s Solved`} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card.Body>
        </Card>
      ) : (
        <p className="text-center">No problem rating data available.</p>
      )}

      {/* Section 3: Problems Solved by Tags Comparison */}
      <h4 className="text-center mt-4">Problems Solved by Tags Comparison</h4>
      {tagDistComparison.length > 0 ? (
        <Card className="mt-3" style={{ boxShadow: '0 4px 8px rgba(0,0,0,0.1)', border: '1px solid #ccc' }}>
          <Card.Body>
            <div style={{ width: '100%', height: '400px', margin: '0 auto' }}>
              <ResponsiveContainer>
                <BarChart
                  data={tagDistComparison}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                  <XAxis dataKey="tag" stroke="#000" />
                  <YAxis stroke="#000" />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #000' }} />
                  <Legend />
                  <Bar dataKey="mySolved" fill="#0057e7" name="Your Solved" />
                  <Bar dataKey="friendSolved" fill="#d62d20" name={`${friendHandle}'s Solved`} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card.Body>
        </Card>
      ) : (
        <p className="text-center">No tag comparison data available.</p>
      )}

      {/* Section 4: Rating Statistics Comparison */}
      {(myRatingStats && friendRatingStats) && (
        <>
          <h4 className="text-center mt-4">Rating Statistics Comparison</h4>
          <Table striped bordered hover responsive style={{ fontFamily: 'Roboto Mono' }}>
            <thead>
              <tr className="text-center">
                <th></th>
                <th>Your Stats</th>
                <th>{friendHandle}'s Stats</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-center">
                <td>Max Increase</td>
                <td>{myRatingStats.maxIncrease}</td>
                <td>{friendRatingStats.maxIncrease}</td>
              </tr>
              <tr className="text-center">
                <td>Max Decrease</td>
                <td>{myRatingStats.maxDecrease}</td>
                <td>{friendRatingStats.maxDecrease}</td>
              </tr>
              <tr className="text-center">
                <td>Average Change</td>
                <td>{myRatingStats.averageDelta.toFixed(2)}</td>
                <td>{friendRatingStats.averageDelta.toFixed(2)}</td>
              </tr>
            </tbody>
          </Table>
        </>
      )}

      {/* Section 5: Common Contests Comparison */}
      {comparisonData.length > 0 && (
        <>
          <h4 className="text-center mt-4">Common Contests Comparison</h4>
          <Table striped bordered hover responsive style={{ fontFamily: 'Roboto Mono' }}>
            <thead>
              <tr className="text-center">
                <th>Contest Name</th>
                <th>Your Rank</th>
                <th>{friendHandle}'s Rank</th>
              </tr>
            </thead>
            <tbody>
              {commonContests.map(contest => (
                <tr key={contest.contestId} className="text-center">
                  <td>{contest.contestName}</td>
                  <td>{contest.myRank}</td>
                  <td>{contest.friendRank}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </Container>
  );
}

export default FriendComparisonPage;
