
import React, { useState, useEffect } from 'react';
import { menuAPI, categoryAPI } from '../services/api';
import { useToast } from './ToastProvider';
import { getSocket } from '../services/realtime';
import './Menu.css';

function Menu({ user, onAddToCart }) {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { showToast } = useToast();

  useEffect(() => {
    fetchData();
    let socket;
    try {
      socket = getSocket();
      socket.on('menu:item:update', handleMenuItemUpdate);
      socket.on('menu:item:add', handleMenuItemAdd);
      socket.on('menu:item:delete', handleMenuItemDelete);
    } catch (_e) {}
    return () => {
      try {
        socket && socket.off('menu:item:update', handleMenuItemUpdate);
        socket && socket.off('menu:item:add', handleMenuItemAdd);
        socket && socket.off('menu:item:delete', handleMenuItemDelete);
      } catch (_e) {}
    };
  }, []);

  const fetchData = async () => {
    try {
      const [menuResponse, categoryResponse] = await Promise.all([
        menuAPI.getAllItems(),
        categoryAPI.getAllCategories(),
      ]);
      
      setMenuItems(menuResponse.data);
      setCategories(categoryResponse.data);
      setLoading(false);
    } catch (err) {
      setError('Failed to load menu items');
      setLoading(false);
    }
  };

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category_id === parseInt(selectedCategory);
    const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleMenuItemUpdate = (updated) => {
    if (!updated || !updated.item_id) return;
    setMenuItems((prev) => prev.map((it) => (it.item_id === updated.item_id ? { ...it, ...updated } : it)));
  };

  const handleMenuItemAdd = (added) => {
    if (!added || !added.item_id) return;
    setMenuItems((prev) => {
      const exists = prev.some((it) => it.item_id === added.item_id);
      return exists ? prev.map((it) => (it.item_id === added.item_id ? { ...it, ...added } : it)) : [...prev, added];
    });
  };

  const handleMenuItemDelete = ({ item_id }) => {
    if (!item_id) return;
    setMenuItems((prev) => prev.filter((it) => it.item_id !== item_id));
  };

  const handleAddToCart = (item) => {
    if (!user) {
      showToast('Please login to add items to cart', 'error');
      return;
    }
    if (user && user.role !== 'customer') {
      showToast('Admins cannot place orders', 'error');
      return;
    }
    onAddToCart(item);
    showToast(`${item.item_name} added to cart!`, 'success');
    try {
      const socket = getSocket();
      socket.emit('cart:add', { item: { item_id: item.item_id, item_name: item.item_name, price: item.price } });
    } catch (_e) {}
  };

  if (loading) {
    return <div className="loading">Loading menu...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="menu-container">
      <div className="menu-header">
        <h1>Our Menu</h1>
        <p>Delicious food at your fingertips</p>
      </div>

      <div className="menu-filters">
        <input
          type="text"
          placeholder="Search for items..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />

        <div className="category-filters">
          <button
            className={selectedCategory === 'all' ? 'active' : ''}
            onClick={() => setSelectedCategory('all')}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.category_id}
              className={selectedCategory === category.category_id.toString() ? 'active' : ''}
              onClick={() => setSelectedCategory(category.category_id.toString())}
            >
              {category.category_name}
            </button>
          ))}
        </div>
      </div>

      <div className="menu-grid">
        {filteredItems.length === 0 ? (
          <p className="no-items">No items found</p>
        ) : (
          filteredItems.map((item) => (
            <div key={item.item_id} className="menu-card">
              <div className="menu-card-image">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.item_name} />
                ) : (
                  <div className="placeholder-image">🍽️</div>
                )}
              </div>
              
              <div className="menu-card-content">
                <h3>{item.item_name}</h3>
                <p className="item-description">{item.description}</p>
                <div className="menu-card-footer">
                  <span className="item-price">₹{item.price}</span>
                  <button
                    className="add-to-cart-btn"
                    onClick={() => handleAddToCart(item)}
                    disabled={!item.is_available || (user && user.role !== 'customer')}
                  >
                    {(!item.is_available) ? 'Unavailable' : (user && user.role !== 'customer') ? 'Admin Only' : 'Add to Cart'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Menu;