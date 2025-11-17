import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import "./App.css";

import Navbar from "./components/Navbar";
import Login from "./components/Login";
import Register from "./components/Register";
import Menu from "./components/Menu";
import Cart from "./components/Cart";
import Orders from "./components/Orders";
import AdminDashboard from "./components/AdminDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import ScrollToTop from "./components/ScrollToTop";
import NotFound from "./components/NotFound";
import ToastProvider from "./components/ToastProvider";
import About from "./components/About";

function App() {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Check if user is logged in with safe parsing
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    if (token && userData) {
      try {
        const parsed = JSON.parse(userData);
        setUser(parsed);
      } catch (_e) {
        localStorage.removeItem("user");
      }
    }
    // hydrate cart
    try {
      const savedCart = localStorage.getItem("cart");
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        if (Array.isArray(parsedCart)) setCart(parsedCart);
      }
    } catch (_e) {}
    setInitializing(false);
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setCart([]);
  };

  const addToCart = (item) => {
    const existingItem = cart.find(
      (cartItem) => cartItem.item_id === item.item_id
    );

    if (existingItem) {
      setCart(
        cart.map((cartItem) =>
          cartItem.item_id === item.item_id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        )
      );
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter((item) => item.item_id !== itemId));
  };

  const updateCartQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
    } else {
      setCart(
        cart.map((item) =>
          item.item_id === itemId ? { ...item, quantity } : item
        )
      );
    }
  };

  const clearCart = () => {
    setCart([]);
  };

  // persist cart
  useEffect(() => {
    try {
      localStorage.setItem("cart", JSON.stringify(cart));
    } catch (_e) {}
  }, [cart]);

  if (initializing) {
    return (
      <div className="App">
        <div style={{ padding: "2rem", textAlign: "center" }}>Loading…</div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <Router>
        <ScrollToTop />
        <div className="App">
          <Navbar user={user} onLogout={handleLogout} cartCount={cart.length} />

          <Routes>
            <Route path="/" element={<About user={user} />} />

            <Route
              path="/login"
              element={
                user ? (
                  <Navigate to="/menu" />
                ) : (
                  <Navigate to="/login/customer" />
                )
              }
            />
            <Route
              path="/login/:role"
              element={
                user ? <Navigate to="/menu" /> : <Login onLogin={handleLogin} />
              }
            />

            <Route
              path="/register"
              element={user ? <Navigate to="/menu" /> : <Register />}
            />
            <Route
              path="/register/:role"
              element={user ? <Navigate to="/menu" /> : <Register />}
            />

            <Route
              path="/menu"
              element={
                <ProtectedRoute
                  isAllowed={
                    !!user &&
                    (user.role === "customer" ||
                      user.role === "admin" ||
                      user.role === "staff")
                  }
                  redirectTo="/login/customer"
                >
                  <Menu user={user} onAddToCart={addToCart} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/cart"
              element={
                <ProtectedRoute
                  isAllowed={!!user && user.role === "customer"}
                  redirectTo="/login/customer"
                >
                  <Cart
                    cart={cart}
                    onUpdateQuantity={updateCartQuantity}
                    onRemove={removeFromCart}
                    onClearCart={clearCart}
                  />
                </ProtectedRoute>
              }
            />

            <Route
              path="/orders"
              element={
                <ProtectedRoute
                  isAllowed={!!user && user.role === "customer"}
                  redirectTo="/login/customer"
                >
                  <Orders />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute
                  isAllowed={!!user && user.role === "admin"}
                  redirectTo="/menu"
                >
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </Router>
    </ToastProvider>
  );
}

export default App;
