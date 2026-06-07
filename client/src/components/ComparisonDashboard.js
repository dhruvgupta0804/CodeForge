import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import {
  Navbar,
  Nav,
  Container,
  Row,
  Col,
  Form,
  Button,
  Table,
  Spinner,
  Alert
} from 'react-bootstrap';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar
} from 'recharts';

/**
 * This component displays:
 * 1. A Bootstrap NavBar with links: Home, Create Mashup, Teams, Contests, Problems, Profile
 * 2. Input fields for your handle and friend’s handle
 * 3. A table of common contests + rank comparison
 * 4. A line chart comparing ranks in common contests
 * 5. Optional bar charts showing tag distribution and rating distribution for each user
 */

function ComparisonDashboard() {
  // Input fields
  const [yourHandle, setYourHandle] = useState('');
  const [friendHandle, setFriendHandle] = useState('');

  // Common contests
  const [commonContests, setCommonContests] = useState([]);

  // Loading & Error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Tag & rating distribution data
  const [yourTagData, setYourTagData] = useState([]);
  const [friendTagData, setFriendTagData] = useState([]);
  const [yourRatingData, setYourRatingData] = useState([]);
  const [friendRatingData, setFriendRatingData] = useState([]);

  const handleCompare = async () => {
    if (!yourHandle.trim() || !friendHandle.trim()) {
      setError('Both handles are required.');
      return;
    }
    setError('');
    setLoading(true);
    setCommonContests([]);
    setYourTagData([]);
    setFriendTagData([]);
    setYourRatingData([]);
    setFriendRatingData([]);

    try {
      // 1. Fetch rating changes for each user
      const [yourRatingRes, friendRatingRes] = await Promise.all([
        fetch(`https://codeforces.com/api/user.rating?handle=${yourHandle.trim()}`),
        fetch(`https://codeforces.com/api/user.rating?handle=${friendHandle.trim()}`)
      ]);
      const yourRatingDataJSON = await yourRatingRes.json();
      const friendRatingDataJSON = await friendRatingRes.json();

      if (yourRatingDataJSON.status !== 'OK' || friendRatingDataJSON.status !== 'OK') {
        throw new Error('Failed to fetch rating data. Check the handles or try again later.');
      }

      // 2. Build a map of contests for each user
      const yourContestsMap = yourRatingDataJSON.result.reduce((map, c) => {
        map[c.contestId] = c;
        return map;
      }, {});
      const friendContestsMap = friendRatingDataJSON.result.reduce((map, c) => {
        map[c.contestId] = c;
        return map;
      }, {});

      // 3. Find intersection of contest IDs
      const commonIds = Object.keys(yourContestsMap).filter((id) => friendContestsMap[id]);
      const commonData = commonIds.map((id) => ({
        contestId: id,
        contestName: yourContestsMap[id].contestName,
        yourRank: yourContestsMap[id].rank,
        friendRank: friendContestsMap[id].rank,
      }));

      // Sort by contestId (or you could sort by date if you have it)
      commonData.sort((a, b) => parseInt(a.contestId) - parseInt(b.contestId));
      setCommonContests(commonData);

      // 4. Fetch user.status for analytics (problem tags & ratings)
      const [yourStatusRes, friendStatusRes] = await Promise.all([
        fetch(`https://codeforces.com/api/user.status?handle=${yourHandle.trim()}&from=1&count=10000`),
        fetch(`https://codeforces.com/api/user.status?handle=${friendHandle.trim()}&from=1&count=10000`)
      ]);
      const yourStatusJSON = await yourStatusRes.json();
      const friendStatusJSON = await friendStatusRes.json();

      if (yourStatusJSON.status === 'OK') {
        const { tagDist, ratingDist } = buildAnalytics(yourStatusJSON.result);
        setYourTagData(tagDist);
        setYourRatingData(ratingDist);
      }
      if (friendStatusJSON.status === 'OK') {
        const { tagDist, ratingDist } = buildAnalytics(friendStatusJSON.result);
        setFriendTagData(tagDist);
        setFriendRatingData(ratingDist);
      }
    } catch (err) {
      setError(err.message || 'Error fetching data.');
    }
    setLoading(false);
  };

  // Helper function to parse user.status results into tag & rating distributions
  const buildAnalytics = (submissions) => {
    const tagCountMap = {};
    const ratingCountMap = {};

    submissions.forEach((sub) => {
      if (sub.verdict === 'OK' && sub.problem) {
        // Count tags
        (sub.problem.tags || []).forEach((t) => {
          tagCountMap[t] = (tagCountMap[t] || 0) + 1;
        });

        // Count ratings
        const rating = sub.problem.rating;
        if (rating) {
          ratingCountMap[rating] = (ratingCountMap[rating] || 0) + 1;
        }
      }
    });

    // Convert maps to arrays for Recharts
    const tagDist = Object.entries(tagCountMap).map(([tag, count]) => ({
      name: tag,
      value: count,
    }));
    // Sort descending by value
    tagDist.sort((a, b) => b.value - a.value);

    const ratingDist = Object.entries(ratingCountMap).map(([rating, count]) => ({
      rating: rating,
      solved: count,
    }));
    // Sort ascending by rating
    ratingDist.sort((a, b) => parseInt(a.rating) - parseInt(b.rating));

    return { tagDist, ratingDist };
  };

  // For the rank line chart
  const rankComparisonData = commonContests.map((c) => ({
    contestName: c.contestName,
    yourRank: c.yourRank,
    friendRank: c.friendRank,
  }));

  return (
    <div>
      {/* NAVBAR */}
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand href="#">Codeforces Visualizer</Navbar.Brand>
          <Navbar.Toggle aria-controls="cf-navbar" />
          <Navbar.Collapse id="cf-navbar">
            <Nav className="ms-auto">
              <Nav.Link href="#">Home</Nav.Link>
              <Nav.Link href="#">Create Mashup</Nav.Link>
              <Nav.Link href="#">Teams</Nav.Link>
              <Nav.Link href="#">Contests</Nav.Link>
              <Nav.Link href="#">Problems</Nav.Link>
              <Nav.Link href="#">Profile</Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container className="mt-4">
        <h2 className="text-center mb-4">Compare Your Codeforces Stats</h2>

        <Row className="justify-content-center">
          <Col xs={12} md={5} className="mb-3">
            <Form.Control
              type="text"
              placeholder="Your Codeforces handle"
              value={yourHandle}
              onChange={(e) => setYourHandle(e.target.value)}
            />
          </Col>
          <Col xs={12} md={5} className="mb-3">
            <Form.Control
              type="text"
              placeholder="Friend's Codeforces handle"
              value={friendHandle}
              onChange={(e) => setFriendHandle(e.target.value)}
            />
          </Col>
          <Col xs={12} md={2} className="mb-3 text-center">
            <Button variant="primary" onClick={handleCompare} className="w-100">
              Compare
            </Button>
          </Col>
        </Row>

        {loading && (
          <div className="text-center my-3">
            <Spinner animation="border" variant="primary" />
          </div>
        )}

        {error && (
          <Alert variant="danger" className="text-center">
            {error}
          </Alert>
        )}

        {/* COMMON CONTESTS TABLE & CHART */}
        {commonContests.length > 0 && (
          <>
            <h3 className="mt-5">Common Contests</h3>
            <Table striped bordered hover responsive className="mt-3">
              <thead>
                <tr>
                  <th>Contest Name</th>
                  <th>Your Rank</th>
                  <th>Friend's Rank</th>
                </tr>
              </thead>
              <tbody>
                {commonContests.map((contest) => (
                  <tr key={contest.contestId}>
                    <td>{contest.contestName}</td>
                    <td>{contest.yourRank}</td>
                    <td>{contest.friendRank}</td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <h3 className="mt-4">Rank Comparison</h3>
            <div className="d-flex justify-content-center">
              <LineChart
                width={800}
                height={300}
                data={rankComparisonData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="contestName" />
                <YAxis reversed={true} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="yourRank" stroke="#8884d8" />
                <Line type="monotone" dataKey="friendRank" stroke="#82ca9d" />
              </LineChart>
            </div>
          </>
        )}

        {/* TAG & RATING DISTRIBUTION CHARTS */}
        {(yourTagData.length > 0 || friendTagData.length > 0) && (
          <>
            <h3 className="mt-5">Problem Tag Distribution</h3>
            <Row className="justify-content-center">
              <Col xs={12} md={6} className="text-center">
                <h5>{yourHandle}</h5>
                <BarChart
                  width={400}
                  height={250}
                  data={yourTagData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </Col>
              <Col xs={12} md={6} className="text-center">
                <h5>{friendHandle}</h5>
                <BarChart
                  width={400}
                  height={250}
                  data={friendTagData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#82ca9d" />
                </BarChart>
              </Col>
            </Row>

            <h3 className="mt-5">Problem Rating Distribution</h3>
            <Row className="justify-content-center">
              <Col xs={12} md={6} className="text-center">
                <h5>{yourHandle}</h5>
                <BarChart
                  width={400}
                  height={250}
                  data={yourRatingData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="rating" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="solved" fill="#8884d8" />
                </BarChart>
              </Col>
              <Col xs={12} md={6} className="text-center">
                <h5>{friendHandle}</h5>
                <BarChart
                  width={400}
                  height={250}
                  data={friendRatingData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="rating" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="solved" fill="#82ca9d" />
                </BarChart>
              </Col>
            </Row>
          </>
        )}
      </Container>
    </div>
  );
}

export default ComparisonDashboard;
