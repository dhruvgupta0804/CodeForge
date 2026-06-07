import React, { useState, useContext } from 'react';
import { Form, Button, Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './LoginPage.css';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function LoginPage() {
    const [username, setUsername] = useState('');
    const [challenge, setChallenge] = useState(null);
    const [loading, setLoading] = useState(false);
    const [checkLoading, setCheckLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login } = useContext(AuthContext);

    // Start the login challenge when the user submits their username.
    const startLogin = async (e) => {
        e.preventDefault();
        if (!username) return;
        setLoading(true);
        setError('');
        setMessage('');
        try {
            const res = await axios.post(`${API_URL}/api/auth/login`, { username });
            setChallenge(res.data);
            // Display the problem link as a clickable href.
            setMessage(
                <>
                    Challenge started! Please submit a compilation error for the following problem within 120 seconds:{' '}
                    <a href={res.data.problemLink} target="_blank" rel="noopener noreferrer">
                        {res.data.problemLink}
                    </a>
                </>
            );
        } catch (err) {
            console.log(err);
            setError(err.response?.data?.error || 'Error starting login challenge');
        }
        setLoading(false);
    };

    // Check if the login challenge has been successfully passed.
    const checkChallenge = async () => {
        if (!challenge) return;
        setCheckLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/auth/challenge-check?challengeId=${challenge.challengeId}`);
            if (res.data.success) {
                login(res.data.token, username);
                setMessage('Login successful!');
                navigate('/');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Error checking challenge');
        }
        setCheckLoading(false);
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h2 className="title">Login</h2>
                {!challenge ? (
                    <Form onSubmit={startLogin}>
                        {error && <Alert variant="danger">{error}</Alert>}
                        <Form.Group className="mb-3">
                            <Form.Label className='text'>Enter your Codeforces Handle:</Form.Label>
                            <Form.Control
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </Form.Group>
                        <Button className="login-button" variant="dark" type="submit" disabled={loading}>
                            {loading ? <Spinner animation="border" size="sm" /> : 'Start Login Challenge'}
                        </Button>
                    </Form>
                ) : (
                    <div>
                        {message && <Alert variant="info">{message}</Alert>}
                        <Button className="login-button" variant="outline-dark" onClick={checkChallenge} disabled={checkLoading}>
                            {checkLoading ? <Spinner animation="border" size="sm" /> : 'Check Challenge'}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default LoginPage;
