import React, { useState, useEffect, useCallback } from 'react';
import { orderAPI } from '../services/api';
import { getSocket } from '../services/realtime';
import './Orders.css';

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const formatPrice = (price) => {
    if (!price && price !== 0) return '0.00';
    const num = typeof price === 'string' ? parseFloat(price) : price;
    return Number.isNaN(num) ? '0.00' : num.toFixed(2);
  };

  const handleOrderUpdate = useCallback((update) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.order_id === update.order_id
          ? { ...o, status: update.status, payment_status: update.payment_status }
          : o
      )
    );
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const response = await orderAPI.getMyOrders(page);
      
      // Extract orders array from response.data object
      // API returns: { orders: [...], page: 1, limit: 20, count: 5 }
      const ordersList = response.data?.orders || [];
      const count = response.data?.count || 0;
      
      if (Array.isArray(ordersList)) {
        setOrders(ordersList);
        setTotalCount(count);
        setError('');
      } else {
        console.error('Orders is not an array:', ordersList);
        setError('Invalid orders data received from server');
        setOrders([]);
      }
    } catch (err) {
      console.error('Failed to load orders:', err.response?.data || err.message);
      setError(err.response?.data?.error || 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchOrders();
    let socket;
    try {
      socket = getSocket();
      socket.on('order:update', handleOrderUpdate);
    } catch (_e) {
      console.warn('Socket connection failed');
    }
    return () => {
      try {
        socket && socket.off('order:update', handleOrderUpdate);
      } catch (_e) {}
    };
  }, [fetchOrders, handleOrderUpdate]);

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

  // --- NEW: Function to display scheduled time ---
  const getScheduleTimeDisplay = (type, scheduledAt) => {
    if (type === 'scheduled' && scheduledAt) {
      const date = new Date(scheduledAt);
      const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // Check if scheduled for today
      const today = new Date();
      if (date.toDateString() === today.toDateString()) {
        return `Scheduled for Today at ${time}`;
      }
      return `Scheduled for ${day} at ${time}`;
    }
    return 'ASAP';
  };
  // ------------------------------------------------

  if (loading) {
    return <div className="loading">Loading orders...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (!orders || orders.length === 0) {
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
          <div 
            key={order.order_id} 
            className={`order-card ${order.order_type === 'scheduled' ? 'order-card-scheduled' : ''}`} // New class for styling
          >
            <div className="order-header">
              <div className="order-info">
                <h3>Order #{order.order_number}</h3>
                <p className="order-date">{formatDate(order.created_at)}</p>
              </div>
              
              {/* --- NEW: Order Type and Scheduled Time Display --- */}
              <div className="order-timing-status">
                <span className={`order-type order-type-${order.order_type}`}>
                  {order.order_type?.toUpperCase() || 'ASAP'}
                </span>
                {order.order_type === 'scheduled' && (
                  <p className="scheduled-time">
                    {getScheduleTimeDisplay(order.order_type, order.scheduled_at)}
                  </p>
                )}
              </div>
              {/* -------------------------------------------------- */}

              <div
                className="order-status"
                style={{ backgroundColor: getStatusColor(order.status) }}
              >
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
                <span>{order.payment_method?.toUpperCase() || 'N/A'}</span>
              </div>
              <div className="order-detail-row">
                <span>Payment Status:</span>
                <span className={`payment-status ${order.payment_status}`}>
                  {order.payment_status?.toUpperCase() || 'UNKNOWN'}
                </span>
              </div>
              {order.special_instructions && (
                <div className="order-detail-row instructions">
                  <span>Special Instructions:</span>
                  <span className="instructions-text">{order.special_instructions}</span>
                </div>
              )}
            </div>

            <div className="order-footer">
              <div className="order-total">
                <span>Total Amount:</span>
                <span className="amount">Rs {formatPrice(order.total_amount)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination (optional) */}
      {totalCount > 0 && (
        <div className="orders-pagination">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="pagination-btn"
          >
            Previous
          </button>
          <span className="page-info">Page {page}</span>
          <button
            disabled={orders.length < 20}
            onClick={() => setPage(page + 1)}
            className="pagination-btn"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default Orders;