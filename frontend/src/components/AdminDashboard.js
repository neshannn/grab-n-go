import React, { useState, useEffect } from 'react';
// Ensure adminAPI is imported. The original file already does this.
import { menuAPI, categoryAPI, adminAPI } from '../services/api';
import { getSocket } from '../services/realtime';

// --- HELPER FUNCTION FOR SCHEDULE DISPLAY (ADD THIS) ---
const formatScheduleDisplay = (scheduledAt) => {
  if (!scheduledAt) return 'N/A';
  const date = new Date(scheduledAt);
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const today = new Date();
  // Check if it's today
  if (date.toDateString() === today.toDateString()) {
    return `Today @ ${time}`;
  }
  return `${day} @ ${time}`;
};
// --------------------------------------------------------


function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
 


  // Fetch all data based on active tab
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (activeTab === 'menu' || activeTab === 'overview') {
          const [menuRes, catRes] = await Promise.all([
            menuAPI.getAllItems(),
            categoryAPI.getAllCategories()
          ]);
          setMenuItems(Array.isArray(menuRes.data) ? menuRes.data : []);
          setCategories(Array.isArray(catRes.data) ? catRes.data : []);
        }
        if (activeTab === 'orders' || activeTab === 'overview') {
          const ordersRes = await adminAPI.getAllOrders(1);
          const ordersList = ordersRes.data?.orders || [];
          setOrders(Array.isArray(ordersList) ? ordersList : []);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeTab]);

  // Real-time socket updates
  useEffect(() => {
    let socket;
    try {
      socket = getSocket();

      // Menu updates
      socket.on('menu:item:add', (newItem) => {
        console.log('Menu item added:', newItem);
        setMenuItems((prev) => {
          const exists = prev.some((item) => item.item_id === newItem.item_id);
          return exists ? prev : [...prev, newItem];
        });
      });

      socket.on('menu:item:update', (updated) => {
        console.log('Menu item updated:', updated);
        setMenuItems((prev) =>
          prev.map((item) => (item.item_id === updated.item_id ? updated : item))
        );
      });

      socket.on('menu:item:delete', ({ item_id }) => {
        console.log('Menu item deleted:', item_id);
        setMenuItems((prev) => prev.filter((item) => item.item_id !== item_id));
      });

      // Order updates
      socket.on('order:new', (newOrder) => {
        console.log('New order:', newOrder);
        setOrders((prev) => [newOrder, ...prev]);
      });

      socket.on('order:update', (updated) => {
        console.log('Order updated:', updated);
        setOrders((prev) =>
          prev.map((order) => (order.order_id === updated.order_id ? updated : order))
        );
      });

      // Category updates
      socket.on('category:add', (newCat) => {
        console.log('Category added:', newCat);
        setCategories((prev) => [...prev, newCat]);
      });

      socket.on('category:update', (updated) => {
        console.log('Category updated:', updated);
        setCategories((prev) =>
          prev.map((cat) => (cat.category_id === updated.category_id ? updated : cat))
        );
      });
    } catch (err) {
      console.warn('Socket connection failed:', err);
    }

    return () => {
      try {
        if (socket) {
          socket.off('menu:item:add');
          socket.off('menu:item:update');
          socket.off('menu:item:delete');
          socket.off('order:new');
          socket.off('order:update');
          socket.off('category:add');
          socket.off('category:update');
        }
      } catch (_e) {}
    };
  }, []);

  // --- Style Helper Function for Status/Payment (ADD/DEFINE THIS) ---
  const getStatusClasses = (status) => {
    switch (status) {
      case 'pending':
      case 'confirmed':
      case 'preparing':
      case 'ready':
        // Yellow/Blue for in-progress/pending
        return status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700';
      case 'completed':
      case 'paid':
        // Green for success
        return 'bg-green-100 text-green-700';
      case 'cancelled':
      case 'refunded':
        // Red for cancelled/refunded
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };
  // -----------------------------------------------------------------


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 py-4 md:py-6">
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Welcome back, Admin</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-auto">
          <div className="flex space-x-8 border-b">
            {[
              { id: 'overview', name: 'Overview', icon: '📊' },
              { id: 'menu', name: 'Menu', icon: '🍔' },
              { id: 'categories', name: 'Categories', icon: '🏷️' },
              { id: 'orders', name: 'Orders', icon: '📦' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
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
        {loading && activeTab !== 'overview' && (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        )}
        {!loading && activeTab === 'overview' && <OverviewTab menuItems={menuItems} orders={orders} />}
        {!loading && activeTab === 'menu' && <MenuTab menuItems={menuItems} categories={categories} />}
        {!loading && activeTab === 'categories' && <CategoriesTab categories={categories} />}
        {/* UPDATED OrdersTab CALL: Pass the new helper function */}
        {!loading && activeTab === 'orders' && <OrdersTab orders={orders} getStatusClasses={getStatusClasses} />}
      </div>
    </div>
  );
}

// Overview Tab
function OverviewTab({ menuItems, orders }) {
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
  const pendingOrders = orders.filter((o) => o.status === 'pending').length;

  const stats = [
    { name: 'Total Orders', value: totalOrders, icon: '🛒', color: 'bg-blue-500' },
    { name: 'Total Revenue', value: `Rs ${totalRevenue.toFixed(2)}`, icon: '💰', color: 'bg-green-500' },
    { name: 'Pending Orders', value: pendingOrders, icon: '⏳', color: 'bg-yellow-500' },
    { name: 'Menu Items', value: menuItems.length, icon: '🍽️', color: 'bg-purple-500' }
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center text-2xl`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Orders</h2>
          <div className="space-y-3">
            {orders.slice(0, 5).map((order) => (
              <div key={order.order_id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{order.order_number}</p>
                  <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">Rs {parseFloat(order.total_amount).toFixed(2)}</p>
                  <p className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                    {order.status.toUpperCase()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Menu Stats */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Menu Stats</h2>
          <div className="space-y-3">
            {menuItems.slice(0, 5).map((item) => (
              <div key={item.item_id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{item.item_name}</p>
                  <p className="text-sm text-gray-500">{item.category_name}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">Rs {parseFloat(item.price).toFixed(2)}</p>
                  <p className={`text-xs px-2 py-1 rounded ${item.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {item.is_available ? 'Available' : 'Unavailable'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Menu Tab
function MenuTab({ menuItems, categories }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    item_name: '',
    category_id: '',
    description: '',
    price: '',
    image_url: '',
    is_available: true
  });
  const [error, setError] = useState('');

  const resetForm = () => {
    setFormData({ item_name: '', category_id: '', description: '', price: '', image_url: '', is_available: true });
    setEditing(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        item_name: formData.item_name.trim(),
        category_id: formData.category_id ? Number(formData.category_id) : null,
        description: formData.description.trim(),
        price: Number(formData.price),
        image_url: formData.image_url.trim() || null,
        is_available: formData.is_available
      };

      if (!payload.item_name || isNaN(payload.price)) {
        setError('Please fill in all required fields');
        return;
      }

      if (editing) {
        await menuAPI.updateItem(editing.item_id, payload);
        alert('Item updated successfully!');
      } else {
        await menuAPI.addItem(payload);
        alert('Item added successfully!');
      }

      resetForm();
      setShowForm(false);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Operation failed';
      setError(msg);
      alert(`Error: ${msg}`);
    }
  };

  const handleEdit = (item) => {
    setEditing(item);
    setFormData({
      item_name: item.item_name,
      category_id: item.category_id || '',
      description: item.description || '',
      price: item.price,
      image_url: item.image_url || '',
      is_available: item.is_available
    });
    setShowForm(true);
  };

  const handleDelete = async (itemId) => {
    if (window.confirm('Delete this item?')) {
      try {
        await menuAPI.deleteItem(itemId);
        alert('Item deleted successfully!');
      } catch (err) {
        alert('Failed to delete item');
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Menu Items ({menuItems.length})</h2>
        <button
          onClick={() => {
            if (showForm) resetForm();
            setShowForm(!showForm);
          }}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors"
        >
          {showForm ? '✕ Cancel' : '+ Add Item'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editing ? 'Edit Item' : 'Add New Item'}
          </h3>
          {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Item Name *</label>
                <input
                  type="text"
                  value={formData.item_name}
                  onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Cheese Burger"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.category_name}
                    </option>
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Item description..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price (Rs) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Image URL</label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_available"
                checked={formData.is_available}
                onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
              />
              <label htmlFor="is_available" className="ml-2 text-sm font-medium text-gray-700">
                Available for order
              </label>
            </div>
            <button
              type="submit"
              className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors"
            >
              {editing ? 'Update Item' : 'Add Item'}
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {menuItems.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">No menu items yet</div>
        ) : (
          menuItems.map((item) => (
            <div key={item.item_id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-40 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.item_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl">🍽️</span>
                )}
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-900">{item.item_name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${item.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {item.is_available ? 'Available' : 'Unavailable'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{item.category_name}</p>
                <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-blue-600">Rs {parseFloat(item.price).toFixed(2)}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDelete(item.item_id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Categories Tab
function CategoriesTab({ categories }) {
  const [newCatName, setNewCatName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setSaving(true);
    try {
      await categoryAPI.addCategory({ category_name: newCatName });
      setNewCatName('');
      alert('Category added successfully!');
    } catch (err) {
      alert('Failed to add category: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (cat) => {
    try {
      await categoryAPI.updateCategory(cat.category_id, {
        category_name: cat.category_name,
        is_active: !cat.is_active
      });
      alert(`Category ${!cat.is_active ? 'activated' : 'deactivated'}!`);
    } catch (err) {
      console.error('Error:', err.response?.data);
      alert('Failed to update category: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Categories ({categories.length})</h2>
        <form onSubmit={handleAddCategory} className="flex items-center gap-2">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="New category name"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <button
            type="submit"
            disabled={saving || !newCatName.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Adding...' : 'Add'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {categories.map((cat) => (
              <tr key={cat.category_id} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-gray-900">{cat.category_id}</td>
                <td className="px-6 py-3 text-gray-900 font-medium">{cat.category_name}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {cat.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <button
                    onClick={() => handleToggleActive(cat)}
                    className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    {cat.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Order Detail Modal Component (FIXED: Improved visibility and z-index)
function OrderDetailModal({ order, orderDetails, loading, onClose, getStatusClasses }) {
  return (
    // FIX 1: Increased Z-index to 50 and ensured full screen coverage
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4"> 
      <div 
        // FIX 2: Reduced max-width (already done, ensuring it stays smaller)
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-6 rounded-t-2xl flex justify-between items-center shadow-lg z-10">
          <div>
            <h2 className="text-2xl font-bold">Order Details</h2>
            <p className="text-indigo-100 text-sm mt-1">Order #{order.order_number}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              <p className="mt-4 text-gray-600">Loading order details...</p>
            </div>
          ) : orderDetails ? (
            <div className="space-y-6">
              {/* Customer Information */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Customer Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-semibold text-gray-900">{order.full_name || order.username || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">User ID</p>
                    <p className="font-semibold text-gray-900">#{order.user_id}</p>
                  </div>
                </div>
              </div>

              {/* Order Information */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Order Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Order Type</p>
                    <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-semibold ${
                      order.order_type === 'scheduled' ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {(order.order_type || 'ASAP').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Order Status</p>
                    <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusClasses(order.status)}`}>
                      {(order.status || 'pending').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Payment Status</p>
                    <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusClasses(order.payment_status)}`}>
                      {(order.payment_status || 'pending').toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-300">
                  <div>
                    <p className="text-sm text-gray-600">Order Placed</p>
                    <p className="font-semibold text-gray-900">{new Date(order.created_at).toLocaleString()}</p>
                  </div>
                  {order.order_type === 'scheduled' && order.scheduled_at && (
                    <div>
                      <p className="text-sm text-gray-600">Scheduled For</p>
                      <p className="font-semibold text-orange-600">{new Date(order.scheduled_at).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items (REFINED UI) */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Order Items
                </h3>
                <ul className="divide-y divide-gray-200">
                  {orderDetails.items && orderDetails.items.length > 0 ? (
                    orderDetails.items.map((item, index) => (
                      <li key={index} className="py-3 px-2 hover:bg-white rounded-lg transition-colors">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 pr-4">
                            <p className="font-semibold text-gray-900 text-base">{item.item_name} <span className="text-sm font-normal text-gray-500">x{item.quantity}</span></p>
                            {/* Display description if available and not the fallback 'No description available.' */}
                            {item.description && item.description !== 'No description available.' && (
                                <p className="text-xs text-gray-500 mt-1 italic line-clamp-2">{item.description}</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-lg text-indigo-600">Rs {(parseFloat(item.subtotal || item.price * item.quantity)).toFixed(2)}</p>
                            <p className="text-xs text-gray-600">(@ Rs {parseFloat(item.price).toFixed(2)}/unit)</p>
                          </div>
                        </div>
                      </li>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No items found</p>
                  )}
                </ul>
              </div>

              {/* Order Summary */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border-2 border-indigo-200">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-700 font-medium">Total Items</p>
                    <p className="text-2xl font-bold text-gray-900">{order.item_count}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-700 font-medium">Total Amount</p>
                    <p className="text-3xl font-extrabold text-indigo-600">Rs {parseFloat(order.total_amount).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p>Failed to load order details</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 px-8 py-4 rounded-b-2xl border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors shadow-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


// Order Actions Component (RETAINED)
function OrderActions({ order, busy, setBusy }) {
  const [status, setStatus] = useState(order.status || 'pending');
  const [payment, setPayment] = useState(order.payment_status || 'pending');

  const handleUpdate = async () => {
    setBusy(true);
    try {
      await adminAPI.updateOrderStatus(order.order_id, { status, payment_status: payment });
      alert('Order updated successfully!');
    } catch (err) {
      alert('Failed to update order: ' + (err.response?.data?.error || err.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500"
      >
        {['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'].map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        value={payment}
        onChange={(e) => setPayment(e.target.value)}
        className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500"
      >
        {['pending', 'paid', 'refunded'].map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <button
        onClick={handleUpdate}
        disabled={busy || (order.status === status && order.payment_status === payment)}
        className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
      >
        {busy ? 'Updating...' : 'Save'}
      </button>
    </div>
  );
}

// Orders Tab (UPDATED: New UI)
function OrdersTab({ orders, getStatusClasses }) {
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchOrderDetails = async (orderId) => {
    setLoadingDetails(true);
    try {
      // Assuming adminAPI has an endpoint for detailed order info
      const response = await adminAPI.getOrderDetails(orderId);
      setOrderDetails(response.data);
    } catch (err) {
      console.error('Failed to fetch order details:', err);
      alert('Failed to load order details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleOrderClick = (order) => {
    setSelectedOrder(order);
    fetchOrderDetails(order.order_id);
  };

  const closeModal = () => {
    setSelectedOrder(null);
    setOrderDetails(null);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">All Customer Orders ({orders.length})</h2>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center text-lg font-medium text-gray-500 border border-gray-100">
          No orders have been placed yet.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-indigo-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider rounded-tl-xl">Order #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Total (Rs)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Payment</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Details / Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider rounded-tr-xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order.order_id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                  
                  {/* Order # (Clickable) */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleOrderClick(order)}
                      className="font-bold text-sm text-indigo-700 hover:text-indigo-900 hover:underline cursor-pointer"
                      title="View Order Details"
                    >
                      {order.order_number}
                    </button>
                    <p className="text-xs text-gray-500 mt-0.5">{order.item_count} Items</p>
                  </td>
                  
                  {/* Customer */}
                  <td className="px-4 py-3 text-gray-800 text-sm">{order.full_name || order.username || `User #${order.user_id}`}</td>
                  
                  {/* Total */}
                  <td className="px-4 py-3 text-green-700 font-extrabold text-base">Rs {parseFloat(order.total_amount).toFixed(2)}</td>
                  
                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusClasses(order.status)}`}>
                      {(order.status || 'pending').toUpperCase()}
                    </span>
                  </td>
                  
                  {/* Payment */}
                  <td className="px-4 py-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusClasses(order.payment_status)}`}>
                      {(order.payment_status || 'pending').toUpperCase()}
                    </span>
                  </td>

                  {/* Type / Schedule / Date */}
                  <td className="px-4 py-3 text-gray-700 text-xs">
                      <span className={`font-semibold text-xs px-2 py-0.5 rounded ${
                        order.order_type === 'scheduled' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'
                      }`}>
                        {(order.order_type || 'ASAP').toUpperCase()}
                      </span>
                      <p className="text-gray-500 mt-1">
                        {order.order_type === 'scheduled' ? formatScheduleDisplay(order.scheduled_at) : new Date(order.created_at).toLocaleDateString()}
                      </p>
                  </td>
                  
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <OrderActions order={order} busy={updatingId === order.order_id} setBusy={(flag) => setUpdatingId(flag ? order.order_id : null)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Order Detail Modal (RENDER THE MODAL) */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          orderDetails={orderDetails}
          loading={loadingDetails}
          onClose={closeModal}
          getStatusClasses={getStatusClasses}
        />
      )}
    </div>
  );
}

export default AdminDashboard;