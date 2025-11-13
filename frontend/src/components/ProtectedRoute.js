import React from 'react';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ isAllowed, redirectTo = '/login', children }) {
  if (!isAllowed) {
    return <Navigate to={redirectTo} replace />;
  }
  return children;
}

export default ProtectedRoute;




