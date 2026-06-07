// src/components/ProfilePage.js
import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Spinner,
  Alert,
  Form,
  Row,
  Col,
} from 'react-bootstrap';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import { useNavigate } from 'react-router-dom';
import './ProfilePage.css';

function ProfilePage() {
  const [handle, setHandle] = useState('');
  const [inputHandle, setInputHandle] = useState('');
  const [profile, setProfile] = useState(null);
  const [ratingChanges, setRatingChanges] = useState([]);
  const [tagDist, setTagDist] = useState([]);
  const [heatmapValues, setHeatmapValues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  // Redirect if not authenticated.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  // Load saved handle.
  useEffect(() => {
    const savedHandle = localStorage.getItem('myHandle');
    if (savedHandle) {
      setHandle(savedHandle);
      setInputHandle(savedHandle);
    }
  }, []);

  // Fetch profile info, rating changes, and submissions.
  useEffect(() => {
    if (!handle) return;
    setLoading(true);
    setError('');
    setProfile(null);
    setRatingChanges([]);
    setTagDist([]);
    setHeatmapValues([]);

    Promise.all([
      fetch(`https://codeforces.com/api/user.info?handles=${handle}`),
      fetch(`https://codeforces.com/api/user.rating?handle=${handle}`),
      fetch(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=10000`),
    ])
      .then(async ([infoRes, ratingRes, statusRes]) => {
        const infoData = await infoRes.json();
        const ratingData = await ratingRes.json();
        const statusData = await statusRes.json();

        if (infoData.status !== 'OK') {
          throw new Error('Error fetching user info.');
        }
        if (ratingData.status !== 'OK') {
          throw new Error('Error fetching rating data.');
        }
        if (statusData.status !== 'OK') {
          throw new Error('Error fetching submissions.');
        }

        setProfile(infoData.result[0]);
        setRatingChanges(ratingData.result);
        buildAnalytics(statusData.result);
      })
      .catch((err) => setError(err.message || 'Something went wrong.'))
      .finally(() => setLoading(false));
  }, [handle]);

  // Process submissions to build tag distribution and heatmap values.
  const buildAnalytics = (submissions) => {
    const tagCountMap = {};
    const dayCountMap = {};

    submissions.forEach((sub) => {
      if (sub.verdict === 'OK' && sub.problem) {
        (sub.problem.tags || []).forEach((tag) => {
          tagCountMap[tag] = (tagCountMap[tag] || 0) + 1;
        });
        const dateObj = new Date(sub.creationTimeSeconds * 1000);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const dayKey = `${yyyy}-${mm}-${dd}`;
        dayCountMap[dayKey] = (dayCountMap[dayKey] || 0) + 1;
      }
    });

    const tagArray = Object.entries(tagCountMap).map(([tag, count]) => ({
      name: tag,
      value: count,
    }));
    tagArray.sort((a, b) => b.value - a.value);
    setTagDist(tagArray);

    const heatmapArray = Object.entries(dayCountMap).map(([date, count]) => ({
      date,
      count,
    }));
    setHeatmapValues(heatmapArray);
  };

  // Save the entered handle.
  const handleSave = () => {
    if (!inputHandle.trim()) {
      setError('Please enter a valid handle.');
      return;
    }
    setError('');
    localStorage.setItem('myHandle', inputHandle.trim());
    setHandle(inputHandle.trim());
  };

  // Logout: clear handle and token.
  const handleLogout = () => {
    localStorage.removeItem('myHandle');
    localStorage.removeItem('token');
    navigate('/login');
  };

  // Utility to shift date (for CalendarHeatmap).
  const shiftDate = (date, numDays) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + numDays);
    return newDate;
  };

  // Extended colors for the pie chart slices.
  const pieColors = [
    '#8884d8',
    '#82ca9d',
    '#ffc658',
    '#ff8042',
    '#8dd1e1',
    '#d0ed57',
    '#FF6384',
    '#36A2EB',
    '#FFCE56',
    '#4BC0C0',
    '#9966FF',
    '#FF9F40',
  ];

  return (
    <div
      className="profile-page"
      style={{
        backgroundColor: '#fff',
        padding: '2rem',
        fontFamily: 'Roboto Mono',
        color: '#000',
      }}
    >
      <h2 className="text-center mb-4">My Profile</h2>
      {!handle ? (
        <div className="mb-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <Form.Group className="mb-3">
            <Form.Control
              type="text"
              placeholder="Enter your Codeforces handle"
              value={inputHandle}
              onChange={(e) => setInputHandle(e.target.value)}
            />
          </Form.Group>
          <div className="text-center">
            <Button variant="dark" onClick={handleSave}>
              Save My Profile
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Top Box: Profile Info & Rating Changes */}
          <Card className="mb-4">
            <Card.Body>
              <Row>
                <Col md={4} className="text-center">
                  {profile && (
                    <>
                      <Card.Img
                        src={profile.titlePhoto}
                        alt={profile.handle}
                        style={{
                          width: '150px',
                          borderRadius: '50%',
                          border: '2px solid #000',
                        }}
                      />
                      <Card.Title className="mt-3">{profile.handle}</Card.Title>
                      <Card.Text>
                        <strong>Rank:</strong> {profile.rank} <br />
                        <strong>Rating:</strong> {profile.rating} <br />
                        <strong>Max Rank:</strong> {profile.maxRank} ({profile.maxRating})
                      </Card.Text>
                      <Button variant="dark" onClick={handleLogout}>
                        Logout
                      </Button>
                    </>
                  )}
                </Col>
                <Col md={8}>
                  <div
                    style={{
                      backgroundColor: '#f5f5f5',
                      padding: '1rem',
                      borderRadius: '8px',
                      minHeight: '350px',
                      position: 'relative',
                    }}
                  >
                    <h4 className="text-center mb-3">Rating Changes</h4>
                    {loading ? (
                      <div className="text-center my-3">
                        <Spinner animation="border" variant="dark" />
                      </div>
                    ) : (
                      ratingChanges.length > 0 && (
                        <ResponsiveContainer width="100%" height={350}>
                          <LineChart
                            data={ratingChanges.map((rc) => ({
                              contest: rc.contestName,
                              rating: rc.newRating,
                            }))}
                            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                          >
                            {/* Reference areas for rating segments */}
                            <ReferenceArea y1={0} y2={1200} fill="#686968" fillOpacity={0.5} />
                            <ReferenceArea y1={1200} y2={1400} fill="#39f70a" fillOpacity={0.5} />
                            <ReferenceArea y1={1400} y2={1600} fill="#05fcd7" fillOpacity={0.5} />
                            <ReferenceArea y1={1600} y2={1900} fill="#0905fc" fillOpacity={0.5} />
                            <ReferenceArea y1={1900} y2={2100} fill="#ae05fc" fillOpacity={0.5} />
                            <ReferenceArea y1={2100} y2={2300} fill="#fc7d05" fillOpacity={0.5} />
                            <ReferenceArea y1={2300} y2={3000} fill="#fc0d05" fillOpacity={0.5} />

                            <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                            <XAxis dataKey="contest" stroke="#000" />
                            <YAxis stroke="#000" />
                            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #000' }} />
                            <Legend />
                            <Line type="monotone" dataKey="rating" stroke="#000" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      )
                    )}
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Middle Section: Pie Chart & Legend List */}
          <Row className="mb-4">
            <Col md={6} className="text-center">
              <Card>
                <Card.Body>
                  <h4 className="mb-3">Problem Tag Distribution</h4>
                  {tagDist.length > 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <PieChart width={400} height={400}>
                        <Pie
                          data={tagDist}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={120}
                          label
                        >
                          {tagDist.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #000' }} />
                      </PieChart>
                    </div>
                  ) : (
                    <p>No data available.</p>
                  )}
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card>
                <Card.Body>
                  <h4 className="text-center mb-3">Tag Legend</h4>
                  {tagDist.length > 0 ? (
                    <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {tagDist.map((entry, index) => (
                          <li
                            key={index}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              marginBottom: '0.5rem',
                            }}
                          >
                            <div
                              style={{
                                width: '20px',
                                height: '20px',
                                backgroundColor: pieColors[index % pieColors.length],
                                marginRight: '0.5rem',
                              }}
                            ></div>
                            <span>
                              {entry.name}: {entry.value}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-center">No legend data available.</p>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* New Row: Heatmap Section */}
          <Row className="mb-4">
            <Col>
              <Card>
                <Card.Body className="text-center">
                  <h4 className="mb-3">Daily Solve Streak (Past Year)</h4>
                  {heatmapValues.length > 0 ? (
                    <CalendarHeatmap
                      startDate={shiftDate(new Date(), -365)}
                      endDate={new Date()}
                      values={heatmapValues}
                      classForValue={(value) => {
                        if (!value || value.count === 0) {
                          return 'color-empty';
                        }
                        if (value.count >= 5) return 'color-scale-4';
                        if (value.count >= 3) return 'color-scale-3';
                        if (value.count >= 2) return 'color-scale-2';
                        return 'color-scale-1';
                      }}
                      tooltipDataAttrs={(value) => ({
                        'data-tip': value.date
                          ? `${value.date} — ${value.count} solve(s)`
                          : 'No solves',
                      })}
                      showWeekdayLabels
                    />
                  ) : (
                    <p>No solve data available.</p>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}

export default ProfilePage;
