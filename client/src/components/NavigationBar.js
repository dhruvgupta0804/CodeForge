// src/NavigationBar.js
import React from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';
// Make sure to adjust the path below to your actual logo file location:
import codeforgeLogo from './assets/codeforgeLogo.png';

function NavigationBar() {
  // Check if token exists in localStorage to determine login state.
  const token = localStorage.getItem('token');

  const handleLogout = () => {
    // Clear the authentication data.
    localStorage.removeItem('token');
    localStorage.removeItem('myHandle');
    // Redirect to the login page.
    window.location.href = '/login';
  };

  return (
    <Navbar
      expand="lg"
      style={{
        backgroundColor: '#ffffff',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        fontFamily: 'sans-serif',
      }}
    >
      <Container>
        {/* Brand with logo (includes text in the image) */}
        <Navbar.Brand as={Link} to="/">
          <img
            src= "./photos/logo.jpg"
            alt="CodeForge Logo"
            style={{ height: '40px' }}
          />
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="codeforge-navbar" />
        <Navbar.Collapse id="codeforge-navbar" className="justify-content-end">
          <Nav>
            <Nav.Link as={Link} to="/" style={{ color: '#333' }}>
              Home
            </Nav.Link>
            <Nav.Link as={Link} to="/contests" style={{ color: '#333' }}>
              Contests
            </Nav.Link>
            <Nav.Link as={Link} to="/custom-contest" style={{ color: '#333' }}>
              Custom Contest
            </Nav.Link>
            <Nav.Link as={Link} to="/problems" style={{ color: '#333' }}>
              Problems
            </Nav.Link>
            <Nav.Link as={Link} to="/friends" style={{ color: '#333' }}>
              My Friends
            </Nav.Link>
            <Nav.Link as={Link} to="/profile" style={{ color: '#333' }}>
              Profile
            </Nav.Link>
            {token ? (
              <Nav.Link onClick={handleLogout} style={{ color: '#333' }}>
                Logout
              </Nav.Link>
            ) : (
              <Nav.Link as={Link} to="/login" style={{ color: '#333' }}>
                Login
              </Nav.Link>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default NavigationBar;
