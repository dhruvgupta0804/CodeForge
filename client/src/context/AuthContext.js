// client/src/context/AuthContext.js
import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Initialize auth state from localStorage
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(localStorage.getItem('myHandle'));

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const login = (newToken, newUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('myHandle', newUser);
    setToken(newToken);
    setUser(newUser);

    // Build/update this user's profile for collaborative filtering
    fetch(`${API_URL}/api/recommendations/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUser })
    }).catch(err => console.error('Profile update failed:', err));
};

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('myHandle');
    setToken(null);
    setUser(null);
  };

  // (Optional) Listen for storage events in multi-tab scenarios.
  useEffect(() => {
    const syncAuth = (e) => {
      if (e.key === 'token') {
        setToken(e.newValue);
      }
      if (e.key === 'myHandle') {
        setUser(e.newValue);
      }
    };
    window.addEventListener('storage', syncAuth);
    return () => window.removeEventListener('storage', syncAuth);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
