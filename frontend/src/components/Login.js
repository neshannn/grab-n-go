
import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useToast } from './ToastProvider';

function Login({ onLogin }) {
  const { role } = useParams(); // Get role from URL
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const isAdmin = role === 'admin';

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login(formData);
      const { token, user } = response.data;
      
      // Check if user role matches the selected login type
      if (isAdmin && user.role !== 'admin' && user.role !== 'staff') {
        setError('Access denied. Admin credentials required.');
        setLoading(false);
        return;
      }

      if (!isAdmin && (user.role === 'admin' || user.role === 'staff')) {
        setError('Please use Admin login for staff accounts.');
        setLoading(false);
        return;
      }

      onLogin(user, token);
      showToast('Logged in successfully', 'success');
      
      // Redirect based on role
      if (user.role === 'admin' || user.role === 'staff') {
        navigate('/dashboard');
      } else {
        navigate('/menu');
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed. Please try again.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 via-purple-600 to-primary-700 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center text-white hover:text-white/80 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to role selection
        </button>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className={`w-20 h-20 ${isAdmin ? 'bg-purple-100' : 'bg-primary-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
              {isAdmin ? (
                <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              ) : (
                <svg className="w-10 h-10 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {isAdmin ? 'Admin Login' : 'Customer Login'}
            </h2>
            <p className="text-gray-600">
              {isAdmin ? 'Access your admin dashboard' : 'Sign in to order delicious food'}
            </p>
          </div>

          {/* Role switch */}
          <div className="mb-6 grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate('/login/customer')}
              className={`${!isAdmin ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'} rounded-lg py-2 font-semibold hover:opacity-90 transition`}
              type="button"
            >
              Customer
            </button>
            <button
              onClick={() => navigate('/login/admin')}
              className={`${isAdmin ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'} rounded-lg py-2 font-semibold hover:opacity-90 transition`}
              type="button"
            >
              Admin
            </button>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username or Email
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                placeholder="Enter your username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                placeholder="Enter your password"
              />
            </div>

          <button
              type="submit"
              disabled={loading}
              aria-disabled={loading}
              aria-busy={loading}
              className={`w-full ${isAdmin ? 'bg-purple-600 hover:bg-purple-700 focus-visible:ring-purple-300' : 'bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-300'} text-white font-semibold py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-md active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-4`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  <svg className="-ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3m12 0l-4-4m4 4l-4 4M21 16v1a2 2 0 01-2 2H7a2 2 0 01-2-2v-1" />
                  </svg>
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <Link 
                to={`/register/${role || 'customer'}`}
                className={`${isAdmin ? 'text-purple-600 hover:text-purple-700' : 'text-primary-600 hover:text-primary-700'} font-semibold`}
              >
                Register here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;