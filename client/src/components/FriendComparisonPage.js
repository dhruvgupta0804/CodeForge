// src/FriendComparisonPage.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Table, Button, Form, Alert, Spinner } from 'react-bootstrap';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

function FriendComparisonPage() {
    const { friendHandle } = useParams();
    const [myHandle, setMyHandle] = useState(localStorage.getItem('myHandle') || '');
    const [inputMyHandle, setInputMyHandle] = useState('');
    const [commonContests, setCommonContests] = useState([]);
    const [comparisonData, setComparisonData] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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

            // Map contests by contestId for both users
            const myContests = myRatingData.result.reduce((acc, contest) => {
                acc[contest.contestId] = contest;
                return acc;
            }, {});
            const friendContests = friendRatingData.result.reduce((acc, contest) => {
                acc[contest.contestId] = contest;
                return acc;
            }, {});

            const commonIds = Object.keys(myContests).filter(id => friendContests[id]);
            const commonData = commonIds.map(id => ({
                contestId: id,
                contestName: myContests[id].contestName,
                myRank: myContests[id].rank,
                friendRank: friendContests[id].rank,
            }));
            commonData.sort((a, b) => parseInt(a.contestId) - parseInt(b.contestId));
            setCommonContests(commonData);

            const chartData = commonData.map(contest => ({
                contestName: contest.contestName,
                myRank: contest.myRank,
                friendRank: contest.friendRank
            }));
            setComparisonData(chartData);
        } catch (err) {
            setError(err.message || 'Error comparing data.');
        }
        setLoading(false);
    };

    // Prompt to set your handle if not already set
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

    return (
        <Container className="mt-4">
            <h2>Comparison with {friendHandle}</h2>
            {error && <Alert variant="danger">{error}</Alert>}
            {!myHandle && (
                <div className="mb-3">
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
            {loading && <Spinner animation="border" variant="primary" />}
            {comparisonData.length > 0 && (
                <>
                    <h4>Common Contests</h4>
                    <Table striped bordered hover responsive>
                        <thead>
                            <tr>
                                <th>Contest Name</th>
                                <th>Your Rank</th>
                                <th>{friendHandle}'s Rank</th>
                            </tr>
                        </thead>
                        <tbody>
                            {commonContests.map(contest => (
                                <tr key={contest.contestId}>
                                    <td>{contest.contestName}</td>
                                    <td>{contest.myRank}</td>
                                    <td>{contest.friendRank}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                    <h4>Rank Comparison Chart</h4>
                    <LineChart
                        width={800}
                        height={300}
                        data={comparisonData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="contestName" />
                        <YAxis reversed={true} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="myRank" stroke="#8884d8" />
                        <Line type="monotone" dataKey="friendRank" stroke="#82ca9d" />
                    </LineChart>
                </>
            )}
        </Container>
    );
}

export default FriendComparisonPage;
