import React, { useState, useContext } from 'react';
import { Form, Button, Alert, Spinner, Tabs, Tab } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './LoginPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');

  const reset = () => {
    setMessage('');
    setError('');
  };

  // ─── Login ───────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    reset();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Login failed.');
      } else {
        login(data.token, data.username);
        navigate('/');
      }
    } catch (err) {
      setError('Server error. Please try again.');
    }
    setLoading(false);
  };

  // ─── Register ────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    reset();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Registration failed.');
      } else {
        login(data.token, data.username);
        navigate('/');
      }
    } catch (err) {
      setError('Server error. Please try again.');
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      activeTab === 'login' ? handleLogin() : handleRegister();
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2 className="login-title">CodeForge</h2>

        {error && <Alert variant="danger">{error}</Alert>}
        {message && <Alert variant="success">{message}</Alert>}

        <Tabs
          activeKey={activeTab}
          onSelect={(k) => { setActiveTab(k); reset(); }}
          className="mb-4"
        >
          {/* ── Login Tab ── */}
          <Tab eventKey="login" title="Login">
            <Form onKeyDown={handleKeyDown}>
              <Form.Group className="mb-3">
                <Form.Label>Username</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Form.Group>

              <Button
                variant="dark"
                className="w-100"
                onClick={handleLogin}
                disabled={loading}
              >
                {loading
                  ? <Spinner animation="border" size="sm" />
                  : 'Login'}
              </Button>
            </Form>
          </Tab>

          {/* ── Register Tab ── */}
          <Tab eventKey="register" title="Register">
            <Form onKeyDown={handleKeyDown}>
              <Form.Group className="mb-3">
                <Form.Label>Username</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Form.Group>

              <Button
                variant="dark"
                className="w-100"
                onClick={handleRegister}
                disabled={loading}
              >
                {loading
                  ? <Spinner animation="border" size="sm" />
                  : 'Create Account'}
              </Button>
            </Form>
          </Tab>
        </Tabs>
      </div>
    </div>
  );
}

export default LoginPage;