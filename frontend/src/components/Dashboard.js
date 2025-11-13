import React, { useEffect, useState } from 'react';
import { getSocket } from '../services/realtime';
import './Dashboard.css';

function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="dashboard-container">
      <h1>Admin Dashboard</h1>
      
      <div className="dashboard-tabs">
        <button
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={activeTab === 'orders' ? 'active' : ''}
          onClick={() => setActiveTab('orders')}
        >
          Manage Orders
        </button>
        <button
          className={activeTab === 'menu' ? 'active' : ''}
          onClick={() => setActiveTab('menu')}
        >
          Manage Menu
        </button>
        <button
          className={activeTab === 'reports' ? 'active' : ''}
          onClick={() => setActiveTab('reports')}
        >
          Reports
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'orders' && <OrdersManagementTab />}
        {activeTab === 'menu' && <MenuManagementTab />}
        {activeTab === 'reports' && <ReportsTab />}
      </div>
    </div>
  );
}

function OverviewTab() {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    const socket = getSocket();
    const handler = (evt) => {
      setActivities((prev) => [{
        id: evt.at,
        text: `${evt.username || 'Guest'} added ${evt?.item?.item_name || 'an item'} to cart`,
        at: new Date(evt.at).toLocaleTimeString(),
      }, ...prev].slice(0, 10));
    };
    socket.on('cart:activity', handler);
    return () => {
      socket.off('cart:activity', handler);
    };
  }, []);

  return (
    <div className="overview-tab">
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Today's Orders</h3>
          <p className="stat-number">24</p>
          <span className="stat-change positive">+12% from yesterday</span>
        </div>
        
        <div className="stat-card">
          <h3>Revenue</h3>
          <p className="stat-number">₹4,850</p>
          <span className="stat-change positive">+8% from yesterday</span>
        </div>
        
        <div className="stat-card">
          <h3>Pending Orders</h3>
          <p className="stat-number">5</p>
          <span className="stat-change">Active now</span>
        </div>
        
        <div className="stat-card">
          <h3>Total Customers</h3>
          <p className="stat-number">156</p>
          <span className="stat-change positive">+3 new today</span>
        </div>
      </div>

      <div className="recent-activity">
        <h2>Recent Activity</h2>
        <div className="activity-list">
          {activities.length === 0 ? (
            <div className="activity-item">
              <span className="activity-icon">🛒</span>
              <div className="activity-details">
                <p>No recent cart activity</p>
                <span className="activity-time">—</span>
              </div>
            </div>
          ) : (
            activities.map(a => (
              <div key={a.id} className="activity-item">
                <span className="activity-icon">🛒</span>
                <div className="activity-details">
                  <p>{a.text}</p>
                  <span className="activity-time">{a.at}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function OrdersManagementTab() {
  const [orders] = useState([
    { id: 1, orderNumber: 'ORD1234', customer: 'John Doe', items: 3, total: 250, status: 'pending' },
    { id: 2, orderNumber: 'ORD1233', customer: 'Jane Smith', items: 2, total: 180, status: 'preparing' },
    { id: 3, orderNumber: 'ORD1232', customer: 'Mike Johnson', items: 5, total: 420, status: 'ready' },
  ]);

  const updateOrderStatus = (orderId, newStatus) => {
    alert(`Order ${orderId} status updated to ${newStatus}`);
  };

  return (
    <div className="orders-management-tab">
      <h2>Manage Orders</h2>
      
      <div className="orders-table-container">
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order Number</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.orderNumber}</td>
                <td>{order.customer}</td>
                <td>{order.items}</td>
                <td>₹{order.total}</td>
                <td>
                  <span className={`status-badge ${order.status}`}>
                    {order.status}
                  </span>
                </td>
                <td>
                  <select
                    onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                    defaultValue={order.status}
                    className="status-select"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="preparing">Preparing</option>
                    <option value="ready">Ready</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MenuManagementTab() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    item_name: '',
    category_id: '',
    description: '',
    price: '',
    image_url: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Menu item added successfully!');
    setShowAddForm(false);
    setFormData({
      item_name: '',
      category_id: '',
      description: '',
      price: '',
      image_url: ''
    });
  };

  return (
    <div className="menu-management-tab">
      <div className="tab-header">
        <h2>Manage Menu Items</h2>
        <button
          className="add-item-btn"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : '+ Add New Item'}
        </button>
      </div>

      {showAddForm && (
        <div className="add-item-form">
          <h3>Add New Menu Item</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Item Name</label>
                <input
                  type="text"
                  value={formData.item_name}
                  onChange={(e) => setFormData({...formData, item_name: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Category</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                  required
                >
                  <option value="">Select Category</option>
                  <option value="1">Beverages</option>
                  <option value="2">Snacks</option>
                  <option value="3">Main Course</option>
                  <option value="4">Desserts</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Price (₹)</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  required
                  step="0.01"
                />
              </div>
              
              <div className="form-group">
                <label>Image URL</label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </div>

            <button type="submit" className="submit-btn">Add Item</button>
          </form>
        </div>
      )}

      <div className="menu-items-list">
        <h3>Current Menu Items</h3>
        <p>View and manage existing menu items here</p>
      </div>
    </div>
  );
}

function ReportsTab() {
  return (
    <div className="reports-tab">
      <h2>Reports & Analytics</h2>
      
      <div className="report-filters">
        <select className="report-select">
          <option>Today</option>
          <option>This Week</option>
          <option>This Month</option>
          <option>Custom Range</option>
        </select>
      </div>

      <div className="reports-grid">
        <div className="report-card">
          <h3>Sales Report</h3>
          <div className="report-content">
            <p>Total Sales: ₹15,240</p>
            <p>Total Orders: 87</p>
            <p>Average Order Value: ₹175</p>
          </div>
        </div>

        <div className="report-card">
          <h3>Popular Items</h3>
          <div className="report-content">
            <ol>
              <li>Coffee - 45 orders</li>
              <li>Sandwich - 32 orders</li>
              <li>Rice Bowl - 28 orders</li>
              <li>Samosa - 25 orders</li>
            </ol>
          </div>
        </div>

        <div className="report-card">
          <h3>Payment Methods</h3>
          <div className="report-content">
            <p>Cash: 45%</p>
            <p>UPI: 35%</p>
            <p>Card: 15%</p>
            <p>Wallet: 5%</p>
          </div>
        </div>

        <div className="report-card">
          <h3>Order Status</h3>
          <div className="report-content">
            <p>Completed: 78</p>
            <p>Pending: 5</p>
            <p>Preparing: 3</p>
            <p>Cancelled: 1</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;