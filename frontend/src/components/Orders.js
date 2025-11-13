import React, { useState, useEffect } from 'react';
import { orderAPI } from '../services/api';
import { getSocket } from '../services/realtime';
import './Orders.css';

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOrders();
    let socket;
    try {
      socket = getSocket();
      socket.on('order:update', handleOrderUpdate);
    } catch (_e) {}
    return () => {
      try { socket && socket.off('order:update', handleOrderUpdate); } catch (_e) {}
    };
  }, []);

  const handleOrderUpdate = (update) => {
    setOrders((prev) => prev.map(o => (
      o.order_id === update.order_id
        ? { ...o, status: update.status, payment_status: update.payment_status }
        : o
    )));
  };

  const fetchOrders = async () => {
    try {
      const response = await orderAPI.getMyOrders();
      setOrders(response.data);
      setLoading(false);
    } catch (err) {
      setError('Failed to load orders');
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#ffa500',
      confirmed: '#4169e1',
      preparing: '#9370db',
      ready: '#32cd32',
      completed: '#228b22',
      cancelled: '#dc143c'
    };
    return colors[status] || '#808080';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="loading">Loading orders...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="orders-container">
        <div className="empty-orders">
          <h2>No orders yet</h2>
          <p>Start ordering some delicious food!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-container">
      <h1>My Orders</h1>
      
      <div className="orders-list">
        {orders.map((order) => (
          <div key={order.order_id} className="order-card">
            <div className="order-header">
              <div className="order-info">
                <h3>Order #{order.order_number}</h3>
                <p className="order-date">{formatDate(order.created_at)}</p>
              </div>
              <div className="order-status" style={{ backgroundColor: getStatusColor(order.status) }}>
                {order.status.toUpperCase()}
              </div>
            </div>

            <div className="order-details">
              <div className="order-detail-row">
                <span>Items:</span>
                <span>{order.item_count} item(s)</span>
              </div>
              <div className="order-detail-row">
                <span>Payment Method:</span>
                <span>{order.payment_method.toUpperCase()}</span>
              </div>
              <div className="order-detail-row">
                <span>Payment Status:</span>
                <span className={`payment-status ${order.payment_status}`}>
                  {order.payment_status.toUpperCase()}
                </span>
              </div>
              {order.special_instructions && (
                <div className="order-detail-row">
                  <span>Special Instructions:</span>
                  <span>{order.special_instructions}</span>
                </div>
              )}
            </div>

            <div className="order-footer">
              <div className="order-total">
                <span>Total Amount:</span>
                <span className="amount">₹{order.total_amount}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Orders;