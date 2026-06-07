// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Navbar, Nav, Container } from 'react-bootstrap';
import HomePage from './components/HomePage';
import ProfilePage from './components/ProfilePage';
import FriendsPage from './components/FriendsPage';
import ComparisonPage from './components/ComparisonPage';
import ContestsPage from './components/ContestsPage';
import ProblemsPage from './components/ProblemsPage';
import LoginPage from './components/LoginPage';
import ContestPage from './components/ContestPage';
import ContestDetailPage from './components/ContestDetailPage';
import TeamsPage from './components/TeamsPage';
import BlogDetailPage from './components/BlogDetailPage';
import codeforgeLogo from './photos/Logo.png'; // Adjust the path if needed

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));

  useEffect(() => {
    const checkAuth = () => {
      setIsLoggedIn(!!localStorage.getItem('token'));
    };
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, []);

  return (
    <BrowserRouter>
      {/* Custom CSS for enhanced navbar styling */}
      <style type="text/css">
        {`
          .custom-navbar {
            background-color: #ffffff !important;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            font-family: 'Roboto Mono', monospace;
          }
          .nav-link-custom {
            padding: 0.5rem 1rem !important;
            color: #696868 !important;
            transition: color 0.3s ease, transform 0.3s ease;
            font-weight: 400;
          }
          .nav-link-custom:hover {
            color:rgb(0, 0, 0) !important;
            transform: translateY(-2px);
            font-weight: 600;
            font-szie: 1.2rem;
          }
        `}
      </style>
      <Navbar expand="lg" className="custom-navbar">
        <Container>
          {/* Brand with larger logo */}
          <Navbar.Brand as={Link} to="/">
            <img
              src={codeforgeLogo}
              alt="CodeForge Logo"
              style={{ height: '80px' }} // Increased logo height
            />
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="codeforge-navbar" />
          <Navbar.Collapse id="codeforge-navbar">
            <Nav className="ms-auto">
              <Nav.Link as={Link} to="/" className="nav-link-custom">
                Home
              </Nav.Link>
              <Nav.Link as={Link} to="/contests" className="nav-link-custom">
                Contests
              </Nav.Link>
              <Nav.Link as={Link} to="/custom-contest" className="nav-link-custom">
                Custom Contest
              </Nav.Link>
              <Nav.Link as={Link} to="/problems" className="nav-link-custom">
                Problems
              </Nav.Link>
              <Nav.Link as={Link} to="/friends" className="nav-link-custom">
                My Friends
              </Nav.Link>
              <Nav.Link as={Link} to="/teams" className="nav-link-custom">
                Teams
              </Nav.Link>
              <Nav.Link as={Link} to="/profile" className="nav-link-custom">
                Profile
              </Nav.Link>
              <Nav.Link
                as={Link}
                to="/login"
                className="nav-link-custom"
                style={{ display: isLoggedIn ? 'none' : 'block' }}
              >
                Login
              </Nav.Link>
              {isLoggedIn && (
                <Nav.Link
                  onClick={() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('myHandle');
                    setIsLoggedIn(false);
                    window.location.href = '/login';
                  }}
                  className="nav-link-custom"
                >
                  Logout
                </Nav.Link>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container className="mt-4">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/contests" element={<ContestsPage />} />
          <Route path="/custom-contest" element={<ContestPage />} />
          <Route path="/contest/:contestSlug" element={<ContestDetailPage />} />
          <Route path="/problems" element={<ProblemsPage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/compare/:friendHandle" element={<ComparisonPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/blog/:postId" element={<BlogDetailPage />} />
        </Routes>
      </Container>
    </BrowserRouter>
  );
}

export default App;
