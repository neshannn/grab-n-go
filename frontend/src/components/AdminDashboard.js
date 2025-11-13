
import React, { useState, useEffect } from 'react';
import { menuAPI, categoryAPI, orderAPI, adminAPI } from '../services/api';
import { getSocket } from '../services/realtime';

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    item_name: '',
    category_id: '',
    description: '',
    price: '',
    image_url: '',
    is_available: true
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (activeTab === 'menu') {
      fetchMenuItems();
      fetchCategories();
    }
  }, [activeTab]);

  const fetchMenuItems = async () => {
    try {
      const response = await menuAPI.getAllItems();
      setMenuItems(response.data);
    } catch (error) {
      console.error('Failed to fetch menu items', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await categoryAPI.getAllCategories();
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch categories', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      const payload = {
        item_name: formData.item_name,
        category_id: formData.category_id ? Number(formData.category_id) : null,
        description: formData.description,
        price: Number(String(formData.price).replace(',', '.')),
        image_url: formData.image_url || undefined,
        is_available: !!formData.is_available,
      };
      if (!payload.item_name || Number.isNaN(payload.price)) {
        setFormError('Please enter a valid name and numeric price.');
        return;
      }
      if (editingItem) {
        await menuAPI.updateItem(editingItem.item_id, payload);
        alert('Menu item updated successfully!');
      } else {
        await menuAPI.addItem(payload);
        alert('Menu item added successfully!');
      }
      setShowAddForm(false);
      setEditingItem(null);
      setFormData({
        item_name: '',
        category_id: '',
        description: '',
        price: '',
        image_url: '',
        is_available: true
      });
      fetchMenuItems();
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to save menu item';
      setFormError(msg);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      item_name: item.item_name,
      category_id: item.category_id,
      description: item.description,
      price: item.price,
      image_url: item.image_url || '',
      is_available: item.is_available
    });
    setShowAddForm(true);
  };

  const handleDelete = async (itemId) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await menuAPI.deleteItem(itemId);
        alert('Item deleted successfully');
        fetchMenuItems();
      } catch (error) {
        alert('Failed to delete item');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 py-4 md:py-6">
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Welcome back, Admin</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 overflow-x-auto">
          <div className="flex space-x-8 border-b">
            {[
              { id: 'overview', name: 'Overview', icon: '📊' },
              { id: 'menu', name: 'Menu Management', icon: '🍔' },
              { id: 'categories', name: 'Categories', icon: '🏷️' },
              { id: 'orders', name: 'Orders', icon: '📦' },
              { id: 'analytics', name: 'Analytics', icon: '📈' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'menu' && (
          <MenuManagementTab
            menuItems={menuItems}
            categories={categories}
            showAddForm={showAddForm}
            setShowAddForm={setShowAddForm}
            formData={formData}
            setFormData={setFormData}
            handleSubmit={handleSubmit}
            handleEdit={handleEdit}
            handleDelete={handleDelete}
            editingItem={editingItem}
            setEditingItem={setEditingItem}
          />
        )}
        {activeTab === 'orders' && <OrdersTab />}
        {activeTab === 'categories' && (
          <CategoriesTab
            categories={categories}
            refresh={fetchCategories}
            newCategoryName={newCategoryName}
            setNewCategoryName={setNewCategoryName}
          />
        )}
        {activeTab === 'analytics' && <AnalyticsTab />}
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab() {
  const stats = [
    { name: "Today's Orders", value: '24', change: '+12%', icon: '🛒', color: 'bg-blue-500' },
    { name: 'Revenue', value: '₹4,850', change: '+8%', icon: '💰', color: 'bg-green-500' },
    { name: 'Pending Orders', value: '5', change: 'Active', icon: '⏳', color: 'bg-yellow-500' },
    { name: 'Total Menu Items', value: '42', change: '+3 new', icon: '🍽️', color: 'bg-purple-500' },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                <p className="text-sm text-green-600 mt-2">{stat.change}</p>
              </div>
              <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center text-2xl`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {[
            { action: 'New order received', time: '2 minutes ago', icon: '🛒', color: 'bg-blue-100 text-blue-600' },
            { action: 'Order completed', time: '15 minutes ago', icon: '✅', color: 'bg-green-100 text-green-600' },
            { action: 'New menu item added', time: '1 hour ago', icon: '➕', color: 'bg-purple-100 text-purple-600' },
          ].map((activity, index) => (
            <div key={index} className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activity.color}`}>
                {activity.icon}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                <p className="text-xs text-gray-500">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// Menu Management Tab Component
function MenuManagementTab({ menuItems, categories, showAddForm, setShowAddForm, formData, setFormData, handleSubmit, handleEdit, handleDelete, editingItem, setEditingItem }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Menu Items</h2>
        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setEditingItem(null);
            setFormData({
              item_name: '',
              category_id: '',
              description: '',
              price: '',
              image_url: '',
              is_available: true
            });
          }}
          className="bg-primary-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-600 transition-colors flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {showAddForm ? 'Cancel' : 'Add New Item'}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
          </h3>
          {formError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg">{formError}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Item Name</label>
                <input
                  type="text"
                  value={formData.item_name}
                  onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat.category_id} value={cat.category_id}>{cat.category_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price (₹)</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Image URL</label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_available"
                checked={formData.is_available}
                onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="is_available" className="ml-2 text-sm font-medium text-gray-700">
                Available for order
              </label>
            </div>
            <button
              type="submit"
              className="bg-primary-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-600 transition-colors"
            >
              {editingItem ? 'Update Item' : 'Add Item'}
            </button>
          </form>
        </div>
      )}

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {menuItems.map((item) => (
          <div key={item.item_id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
            <div className="h-48 bg-gradient-to-br from-primary-100 to-purple-100 flex items-center justify-center">
              {item.image_url ? (
                <img src={item.image_url} alt={item.item_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-6xl">🍽️</span>
              )}
            </div>
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-gray-900">{item.item_name}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {item.is_available ? 'Available' : 'Unavailable'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-3">{item.description}</p>
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-primary-600">₹{item.price}</span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(item.item_id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Orders Tab Component
function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const fetchOrders = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await adminAPI.getAllOrders();
      setOrders(res.data || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Subscribe to realtime new-order events and refresh
    let socket;
    try {
      socket = getSocket();
      socket.on('order:new', handleOrderNew);
    } catch (_e) {}
    return () => {
      try {
        socket && socket.off('order:new', handleOrderNew);
      } catch (_e) {}
    };
  }, []);

  const handleOrderNew = () => {
    // Light debounce to avoid rapid refetches if multiple events fire
    fetchOrders();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Recent Orders</h2>
        <button onClick={fetchOrders} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium">
          Refresh
        </button>
      </div>
      {loading && (
        <div className="text-gray-500 py-8 text-center">Loading orders…</div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      )}
      {!loading && !error && orders.length === 0 && (
        <div className="text-gray-500 text-center py-12">No orders yet.</div>
      )}
      {!loading && !error && orders.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Placed At</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((o) => (
                <tr key={o.order_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{o.order_number}</td>
                  <td className="px-4 py-3 text-gray-700">{o.full_name || o.username || `User #${o.user_id}`}</td>
                  <td className="px-4 py-3 text-gray-700">{o.item_count}</td>
                  <td className="px-4 py-3 text-gray-900 font-semibold">₹{Number(o.total_amount).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                      {(o.payment_status || 'pending').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">
                      {(o.status || 'pending').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <OrderActions
                      order={o}
                      onUpdated={() => fetchOrders()}
                      busy={updatingId === o.order_id}
                      setBusy={(flag) => setUpdatingId(flag ? o.order_id : null)}
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-sm">{new Date(o.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OrderActions({ order, onUpdated, busy, setBusy }) {
  const [status, setStatus] = useState(order.status || 'pending');
  const [payment, setPayment] = useState(order.payment_status || 'pending');

  const handleUpdate = async () => {
    setBusy(true);
    try {
      await adminAPI.updateOrderStatus(order.order_id, { status, payment_status: payment });
      onUpdated();
    } catch (_e) {
      // noop; could add toast
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-sm border rounded px-2 py-1">
        {['pending','confirmed','preparing','ready','completed','cancelled'].map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select value={payment} onChange={(e) => setPayment(e.target.value)} className="text-sm border rounded px-2 py-1">
        {['pending','paid','refunded'].map(p => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <button onClick={handleUpdate} disabled={busy} className="text-sm px-3 py-1 rounded bg-primary-500 text-white disabled:opacity-50">
        {busy ? 'Updating…' : 'Update'}
      </button>
    </div>
  );
}

// Analytics Tab Component
function AnalyticsTab() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Analytics & Reports</h2>
      <div className="text-gray-500 text-center py-12">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p>Analytics dashboard coming soon...</p>
      </div>
    </div>
  );
}

export default AdminDashboard;

function CategoriesTab({ categories, refresh, newCategoryName, setNewCategoryName }) {
  const [saving, setSaving] = useState(false);

  const addCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ category_name: newCategoryName })
      });
      setNewCategoryName('');
      refresh();
    } catch (_e) {} finally { setSaving(false); }
  };

  const toggleActive = async (cat) => {
    try {
      await fetch(`/api/categories/${cat.category_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ is_active: !cat.is_active })
      });
      refresh();
    } catch (_e) {}
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Categories</h2>
        <form onSubmit={addCategory} className="flex items-center space-x-2">
          <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New category name" className="border rounded px-3 py-2 text-sm" />
          <button type="submit" disabled={saving || !newCategoryName.trim()} className="px-3 py-2 text-sm rounded bg-primary-500 text-white disabled:opacity-50">{saving ? 'Adding…' : 'Add'}</button>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {categories.map((c) => (
              <tr key={c.category_id}>
                <td className="px-4 py-3 text-gray-700">{c.category_id}</td>
                <td className="px-4 py-3 text-gray-900 font-medium">{c.category_name}</td>
                <td className="px-4 py-3">{c.is_active ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(c)} className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">{c.is_active ? 'Deactivate' : 'Activate'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}