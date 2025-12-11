import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import './Navbar.css';

function Navbar({ user, onLogout, cartCount }) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleProfileMenu = () => {
    setShowProfileMenu(!showProfileMenu);
  };

  const handleLogout = () => {
    setShowProfileMenu(false);
    onLogout();
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo" aria-label="Grab N Go Home">
          <span className="logo-icon">🍔</span>
          <span>Grab N Go</span>
        </Link>

        <ul className="navbar-menu">
          <li className="navbar-item">
            <NavLink to="/menu" className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}>Menu</NavLink>
          </li>

          {user ? (
            <>
              {(user.role === 'customer') && (
                <>
                  <li className="navbar-item">
                    <NavLink to="/cart" className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}>
                      <span aria-hidden>🛒</span>
                      <span>Cart</span>
                      {cartCount > 0 && <span className="cart-badge" aria-label={`${cartCount} items in cart`}>{cartCount}</span>}
                    </NavLink>
                  </li>
                  <li className="navbar-item">
                    <NavLink to="/orders" className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}>My Orders</NavLink>
                  </li>
                </>
              )}
              {(user.role === 'admin' || user.role === 'staff') && (
                <li className="navbar-item">
                  <NavLink to="/dashboard" className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}>Dashboard</NavLink>
                </li>
              )}
              
              {/* Profile Menu */}
              <li className="navbar-item profile-dropdown" ref={profileRef}>
                <button 
                  onClick={toggleProfileMenu} 
                  className={`profile-button ${user.role === 'admin' || user.role === 'staff' ? 'admin-profile' : ''}`}
                  aria-label="User profile menu"
                  aria-expanded={showProfileMenu}
                >
                  <div className="profile-icon">
                    <span className="profile-avatar">
                      {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                    </span>
                    {(user.role === 'admin' || user.role === 'staff') && (
                      <span className="admin-badge" aria-label="Admin user">🔒</span>
                    )}
                  </div>
                </button>

                {showProfileMenu && (
                  <div className="profile-menu">
                    <div className="profile-menu-header">
                      <div className="profile-menu-avatar">
                        {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="profile-menu-info">
                        <div className="profile-menu-name">{user.fullName}</div>
                        <div className="profile-menu-email">{user.username}</div>
                      </div>
                    </div>
                    {(user.role === 'admin' || user.role === 'staff') && (
                      <div className="profile-menu-role">
                        <span className="role-badge">{user.role === 'admin' ? 'Administrator' : 'Staff'}</span>
                      </div>
                    )}
                    <div className="profile-menu-divider"></div>
                    <button onClick={handleLogout} className="profile-menu-logout">
                      <span>🚪</span>
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </li>
            </>
          ) : (
            <>
              <li className="navbar-item">
                <NavLink to="/login" className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}>Login</NavLink>
              </li>
              <li className="navbar-item">
                <Link to="/register" className="navbar-button">Register</Link>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;