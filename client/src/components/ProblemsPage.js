// src/components/ProblemsPage.js
import React, { useState, useEffect } from 'react';
import {
  Tabs,
  Tab,
  Form,
  Button,
  Table,
  Alert,
  Spinner,
  Row,
  Col,
  ListGroup,
} from 'react-bootstrap';

function ProblemsPage() {
  // ----- Tab and Pagination State -----
  const [activeKey, setActiveKey] = useState('latest');
  const [currentPage, setCurrentPage] = useState(0); // for Latest Problems pagination
  const problemsPerPage = 50;

  // ----- Latest Problems State -----
  const [problems, setProblems] = useState([]);
  const [filteredProblems, setFilteredProblems] = useState([]);
  const [allFilteredProblems, setAllFilteredProblems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterRatingMin, setFilterRatingMin] = useState('');
  const [filterRatingMax, setFilterRatingMax] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [error, setError] = useState('');

  // ----- Recommendations Tab State -----
  const [weakTopics, setWeakTopics] = useState([]); // Array of objects: { tag, accepted, wrong, ratio }
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [recommendedProblems, setRecommendedProblems] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState('');
  const [myRating, setMyRating] = useState(null);

  // ----- Fetch all problems on mount -----
  useEffect(() => {
    setLoading(true);
    fetch('https://codeforces.com/api/problemset.problems')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'OK') {
          // Only use problems with a contestId
          let probs = data.result.problems.filter((p) => p.contestId);
          // Sort descending by contestId (proxy for "latest")
          probs.sort((a, b) => b.contestId - a.contestId);
          setProblems(probs);
          // Initialize filteredProblems with the first page (50 problems)
          setFilteredProblems(probs.slice(0, problemsPerPage));
        } else {
          setError('Error fetching problems');
        }
      })
      .catch(() => setError('Error fetching problems'))
      .finally(() => setLoading(false));
  }, []);

  // ----- Filtering function for Latest Problems -----
  const handleFilter = () => {
    let filtered = problems;
    if (filterRatingMin !== '' || filterRatingMax !== '') {
      filtered = filtered.filter((p) => {
        if (!p.rating) return false;
        const rating = p.rating;
        if (filterRatingMin !== '' && rating < parseInt(filterRatingMin)) return false;
        if (filterRatingMax !== '' && rating > parseInt(filterRatingMax)) return false;
        return true;
      });
    }
    if (filterTag.trim() !== '') {
      filtered = filtered.filter((p) => p.tags && p.tags.includes(filterTag.trim()));
    }
    // Reset pagination
    setCurrentPage(0);
    setAllFilteredProblems(filtered);
    setFilteredProblems(filtered.slice(0, problemsPerPage));
  };

  // ----- Pagination: Update filteredProblems when currentPage changes -----
  /*  useEffect(() => {
      const start = currentPage * problemsPerPage;
      setFilteredProblems(problems.slice(start, start + problemsPerPage));
    }, [currentPage, problems]); */
  useEffect(() => {
    const source =
      allFilteredProblems.length > 0
        ? allFilteredProblems
        : problems;

    const start = currentPage * problemsPerPage;

    setFilteredProblems(
      source.slice(start, start + problemsPerPage)
    );
  }, [currentPage, problems, allFilteredProblems]);

  // ----- Recommendations: Fetch user's weak topics and current rating -----
  const fetchWeakTopicsAndRating = () => {
    const myHandle = localStorage.getItem('myHandle');
    if (!myHandle) {
      setRecError('Please set your profile handle first.');
      return;
    }
    setRecLoading(true);
    setRecError('');
    // Fetch user info to get current rating.
    fetch(`https://codeforces.com/api/user.info?handles=${myHandle}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'OK') {
          const profile = data.result[0];
          setMyRating(profile.rating);
        } else {
          throw new Error('Error fetching user info.');
        }
      })
      .catch((err) => setRecError(err.message));

    // Fetch submissions to compute weak topics.
    fetch(`https://codeforces.com/api/user.status?handle=${myHandle}&from=1&count=10000`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== 'OK') throw new Error('Error fetching your submissions');
        const submissions = data.result;
        const tagStats = {}; // { tag: { accepted, total } }
        submissions.forEach((sub) => {
          if (sub.problem && sub.problem.tags) {
            sub.problem.tags.forEach((tag) => {
              if (!tagStats[tag]) {
                tagStats[tag] = { accepted: 0, total: 0 };
              }
              if (sub.verdict === 'OK') {
                tagStats[tag].accepted += 1;
              }
              tagStats[tag].total += 1;
            });
          }
        });
        // Identify weak topics: only if total >=15 and ratio < 0.6.
        const weakTopicsList = [];
        for (const tag in tagStats) {
          if (tagStats[tag].total >= 5) {
            const accepted = tagStats[tag].accepted;
            const wrong = tagStats[tag].total - accepted;
            if (wrong === 0) continue;
            const ratio = accepted / wrong;
            if (ratio < 0.6) {
              weakTopicsList.push({ tag, accepted, wrong, ratio: ratio.toFixed(2) });
            }
          }
        }
        weakTopicsList.sort((a, b) => parseFloat(a.ratio) - parseFloat(b.ratio));
        setWeakTopics(weakTopicsList);
      })
      .catch((err) => setRecError(err.message))
      .finally(() => setRecLoading(false));
  };

  // When switching to the Recommendations tab, fetch weak topics and rating.
  useEffect(() => {
    if (activeKey === 'recommendations') {
      setSelectedTopic(null);
      setRecommendedProblems([]);
      fetchWeakTopicsAndRating();
    }
  }, [activeKey]);

  // ----- Fetch recommended problems for a selected weak topic -----
  const fetchProblemsForTopic = (topic) => {
    if (myRating === null) {
      setRecError('Unable to determine your current rating.');
      return;
    }
    setRecLoading(true);
    setRecError('');
    setSelectedTopic(topic);
    // Filter problems that include the topic and whose rating is between myRating and (myRating + 300)
    let recs = problems.filter(
      (p) =>
        p.tags &&
        p.tags.includes(topic) &&
        p.rating &&
        p.rating >= myRating + 100 &&
        p.rating <= myRating + 500
    );
    recs.sort((a, b) => a.rating - b.rating);
    setRecommendedProblems(recs.slice(0, 50));
    setRecLoading(false);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Problems</h1>
      <Tabs
        id="problems-tabs"
        activeKey={activeKey}
        onSelect={(k) => {
          setActiveKey(k);
          if (k === 'latest') setCurrentPage(0);
        }}
        className="mb-3"
      >
        {/* Latest Problems Tab */}
        <Tab eventKey="latest" title="Latest Problems">
          {loading && <Spinner animation="border" variant="dark" />}
          {error && <Alert variant="danger">{error}</Alert>}
          <Form className="mb-3">
            <Row className="align-items-end">
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Rating Min</Form.Label>
                  <Form.Control
                    type="number"
                    value={filterRatingMin}
                    onChange={(e) => setFilterRatingMin(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Rating Max</Form.Label>
                  <Form.Control
                    type="number"
                    value={filterRatingMax}
                    onChange={(e) => setFilterRatingMax(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Problem Tag</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="e.g. greedy"
                    value={filterTag}
                    onChange={(e) => setFilterTag(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Button
                  style={{ width: '100%', fontWeight: 'bold' }}
                  variant="dark"
                  onClick={handleFilter}
                >
                  Apply Filters
                </Button>
              </Col>
            </Row>
          </Form>
          <Table striped bordered hover responsive className="mt-3">
            <thead>
              <tr>
                <th>Contest ID</th>
                <th>Index</th>
                <th>Name</th>
                <th>Rating</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              {filteredProblems.map((p, idx) => (
                <tr key={idx}>
                  <td>{p.contestId}</td>
                  <td>{p.index}</td>
                  <td>
                    <a
                      href={`https://codeforces.com/contest/${p.contestId}/problem/${p.index}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {p.name}
                    </a>
                  </td>
                  <td>{p.rating ? p.rating : 'N/A'}</td>
                  <td>{p.tags.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          {/* Pagination Controls */}
          <Row className="mt-3">
            <Col md={6}>
              <Button
                style={{ width: '100%', fontWeight: 'bold' }}
                variant="dark"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 0))}
                disabled={currentPage === 0}
              >
                Previous
              </Button>
            </Col>
            <Col md={6}>
              <Button
                style={{ width: '100%', fontWeight: 'bold' }}
                variant="dark"
                onClick={() => setCurrentPage((prev) => prev + 1)}
                disabled={(currentPage + 1) * problemsPerPage >= problems.length}
              >
                Next
              </Button>
            </Col>
          </Row>
        </Tab>

        {/* Recommendations Tab */}
        <Tab eventKey="recommendations" title="Recommendations">
          {recLoading && <Spinner animation="border" variant="dark" />}
          {recError && <Alert variant="danger">{recError}</Alert>}
          <p className="mt-3">
            Recommendations are based on your weak topics (problem tags with a low
            accepted-to-wrong ratio, ignoring tags with fewer than 5 solved problems).
          </p>
          {weakTopics.length > 0 ? (
            <div style={{ overflowX: 'auto', whiteSpace: 'nowrap' }} className="mb-3">
              <ListGroup horizontal>
                {weakTopics.map((item) => (
                  <ListGroup.Item key={item.tag} className="px-3">
                    <Button
                      style={{ fontWeight: 'bold' }}
                      variant="dark"
                      onClick={() => fetchProblemsForTopic(item.tag)}
                    >
                      {item.tag} (acc: {item.accepted}, wrong: {item.wrong}, ratio: {item.ratio})
                    </Button>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </div>
          ) : (
            <p>No weak topics detected.</p>
          )}
          {selectedTopic && (
            <>
              <h4>Recommended Problems for "{selectedTopic}"</h4>
              <Table striped bordered hover responsive className="mt-3">
                <thead>
                  <tr>
                    <th>Contest ID</th>
                    <th>Index</th>
                    <th>Name</th>
                    <th>Rating</th>
                    <th>Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendedProblems.map((p, idx) => (
                    <tr key={idx}>
                      <td>{p.contestId}</td>
                      <td>{p.index}</td>
                      <td>
                        <a
                          href={`https://codeforces.com/contest/${p.contestId}/problem/${p.index}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {p.name}
                        </a>
                      </td>
                      <td>{p.rating ? p.rating : 'N/A'}</td>
                      <td>{p.tags.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </Tab>
      </Tabs>
    </div>
  );
}

export default ProblemsPage;
