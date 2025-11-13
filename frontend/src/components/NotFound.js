import React from 'react';
import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Page not found</h1>
      <p style={{ marginBottom: '1rem' }}>The page you are looking for doesn\'t exist.</p>
      <Link to="/menu" style={{ color: '#2563eb' }}>Go back to menu</Link>
    </div>
  );
}

export default NotFound;




