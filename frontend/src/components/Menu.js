import React, { useState, useEffect, useCallback } from 'react';
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
  
  // Filters out items explicitly marked as inactive (is_active = 0)
  const filterActiveItems = (items) => {
    return items.filter(item => item.is_active === 1 || item.is_active === true || item.is_active === undefined);
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [menuResponse, categoryResponse] = await Promise.all([
        menuAPI.getAllItems(),
        categoryAPI.getAllCategories(),
      ]);
      
      const rawMenuItems = menuResponse.data;
      
      // Filter out soft-deleted items on initial load
      const activeMenuItems = filterActiveItems(rawMenuItems);

      console.log('Menu items fetched:', activeMenuItems.length, 'active items');
      setMenuItems(activeMenuItems);
      setCategories(categoryResponse.data);
      setError('');
    } catch (err) {
      console.error('Failed to load menu:', err);
      setError('Failed to load menu items');
      setMenuItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle real-time menu updates
  const handleMenuItemUpdate = useCallback((updated) => {
    if (!updated || !updated.item_id) {
      console.warn('Invalid update data:', updated);
      return;
    }
    
    // If an update marks the item as inactive, remove it from the customer view
    if (updated.hasOwnProperty('is_active') && updated.is_active === 0) {
      setMenuItems((prev) => prev.filter((it) => it.item_id !== updated.item_id));
      console.log(`Menu item ${updated.item_id} soft-deleted via update and removed.`);
      return;
    }
    
    console.log('Menu item updated:', updated);
    setMenuItems((prev) =>
      prev.map((it) => (it.item_id === updated.item_id ? { ...it, ...updated } : it))
    );
  }, []);

  // Handle new menu items being added
  const handleMenuItemAdd = useCallback((added) => {
    if (!added || !added.item_id) {
      console.warn('Invalid add data:', added);
      return;
    }
    
    // Ignore if the added item is inactive
    if (added.is_active === 0) {
      console.log('Ignoring added item because it is inactive:', added.item_id);
      return;
    }
    
    console.log('Menu item added:', added);
    setMenuItems((prev) => {
      const exists = prev.some((it) => it.item_id === added.item_id);
      if (exists) {
        return prev.map((it) =>
          it.item_id === added.item_id ? { ...it, ...added } : it
        );
      } else {
        return [...prev, added];
      }
    });
  }, []);

  // Handle menu item deletion event
  const handleMenuItemDelete = useCallback(({ item_id }) => {
    if (!item_id) {
      console.warn('Invalid delete data:', item_id);
      return;
    }
    console.log('Menu item deleted:', item_id);
    setMenuItems((prev) => prev.filter((it) => it.item_id !== item_id));
  }, []);

  useEffect(() => {
    fetchData();
    
    let socket;
    try {
      socket = getSocket();
      
      // Set up socket listeners for real-time menu synchronization
      socket.on('menu:item:add', handleMenuItemAdd);
      socket.on('menu:item:update', handleMenuItemUpdate);
      socket.on('menu:item:delete', handleMenuItemDelete); 
      
      console.log('Socket listeners registered for menu updates');
    } catch (err) {
      console.warn('Socket connection failed:', err);
    }

    return () => {
      try {
        if (socket) {
          socket.off('menu:item:add', handleMenuItemAdd);
          socket.off('menu:item:update', handleMenuItemUpdate);
          socket.off('menu:item:delete', handleMenuItemDelete);
        }
      } catch (_e) {}
    };
  }, [fetchData, handleMenuItemAdd, handleMenuItemUpdate, handleMenuItemDelete]);

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory =
      selectedCategory === 'all' || item.category_id === parseInt(selectedCategory);
    const matchesSearch = item.item_name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
      
    // Final display filter: ensure item is still active
    const isActive = item.is_active === 1 || item.is_active === true || item.is_active === undefined;
    
    return matchesCategory && matchesSearch && isActive;
  });

  const handleAddToCart = (item) => {
    // Prevent ordering of soft-deleted items
    if (item.is_active === 0) {
      showToast('This item has been removed from the menu and cannot be ordered.', 'error');
      return;
    }
    
    if (!user) {
      showToast('Please login to add items to cart', 'error');
      return;
    }
    // Prevent admin from adding items to cart
    if (user && user.role !== 'customer') {
      showToast('Admins cannot place orders', 'error');
      return;
    }
    
    onAddToCart(item);
    showToast(`${item.item_name} added to cart!`, 'success');
    
    try {
      const socket = getSocket();
      socket.emit('cart:add', {
        item: {
          item_id: item.item_id,
          item_name: item.item_name,
          price: item.price,
          quantity: 1
        }
      });
    } catch (_e) {
      console.warn('Failed to emit cart:add event');
    }
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
                  <span className="item-price">Rs {item.price}</span>
                  <button
                    className="add-to-cart-btn"
                    onClick={() => handleAddToCart(item)}
                    disabled={
                      !item.is_available || (user && user.role !== 'customer') || item.is_active === 0
                    }
                  >
                    {item.is_active === 0 
                      ? 'Removed'
                      : !item.is_available
                      ? 'Unavailable'
                      : user && user.role !== 'customer'
                      ? 'Customers Only'
                      : 'Add to Cart'}
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