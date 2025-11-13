import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import './Navbar.css';

function Navbar({ user, onLogout, cartCount }) {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo" aria-label="Grab N Go Home">
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 12,
            background: 'linear-gradient(135deg,#0ea5e9,#6366f1)'
          }}>🍔</span>
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
              <li className="navbar-item">
                <span className="navbar-user" title={user.username}>
                  {user.role === 'admin' || user.role === 'staff' ? '🛠️' : '👤'} {user.fullName}
                </span>
              </li>
              <li className="navbar-item">
                <button onClick={onLogout} className="navbar-button">Logout</button>
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