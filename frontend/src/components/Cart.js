
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderAPI } from '../services/api';
import { useToast } from './ToastProvider';
import './Cart.css';

function Cart({ cart, onUpdateQuantity, onRemove, onClearCart }) {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      showToast('Your cart is empty', 'error');
      return;
    }

    setLoading(true);

    try {
      const orderData = {
        items: cart.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          price: item.price
        })),
        payment_method: paymentMethod,
        special_instructions: specialInstructions
      };

      const response = await orderAPI.createOrder(orderData);
      showToast(`Order placed successfully! #${response.data.orderNumber}`, 'success');
      onClearCart();
      navigate('/orders');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to place order. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const confirmRemove = (itemId) => {
    if (window.confirm('Remove this item from cart?')) {
      onRemove(itemId);
      showToast('Item removed from cart', 'info');
    }
  };

  const confirmClear = () => {
    if (window.confirm('Clear all items from cart?')) {
      onClearCart();
      showToast('Cart cleared', 'info');
    }
  };

  if (cart.length === 0) {
    return (
      <div className="cart-container">
        <div className="empty-cart">
          <h2>Your cart is empty</h2>
          <p>Add some delicious items from our menu!</p>
          <button onClick={() => navigate('/menu')} className="continue-shopping-btn">
            Browse Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-container">
      <h1>Your Cart</h1>
      
      <div className="cart-content">
        <div className="cart-items">
          {cart.map((item) => (
            <div key={item.item_id} className="cart-item">
              <div className="cart-item-image">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.item_name} />
                ) : (
                  <div className="placeholder-image">🍽️</div>
                )}
              </div>
              
              <div className="cart-item-details">
                <h3>{item.item_name}</h3>
                <p className="cart-item-price">₹{item.price}</p>
              </div>
              
              <div className="cart-item-quantity">
                <button
                  onClick={() => onUpdateQuantity(item.item_id, item.quantity - 1)}
                  className="quantity-btn"
                >
                  -
                </button>
                <span>{item.quantity}</span>
                <button
                  onClick={() => onUpdateQuantity(item.item_id, item.quantity + 1)}
                  className="quantity-btn"
                >
                  +
                </button>
              </div>
              
              <div className="cart-item-subtotal">
                <p>₹{(item.price * item.quantity).toFixed(2)}</p>
              </div>
              
              <button
                onClick={() => confirmRemove(item.item_id)}
                className="remove-btn"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="cart-summary">
          <h2>Order Summary</h2>
          
          <div className="summary-row">
            <span>Subtotal:</span>
            <span>₹{calculateTotal().toFixed(2)}</span>
          </div>
          
          <div className="summary-row total">
            <span>Total:</span>
            <span>₹{calculateTotal().toFixed(2)}</span>
          </div>

          <div className="payment-method">
            <label>Payment Method:</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="wallet">Wallet</option>
            </select>
          </div>

          <div className="special-instructions">
            <label>Special Instructions:</label>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Any special requests?"
              rows="3"
            />
          </div>

          <button
            onClick={handlePlaceOrder}
            className="place-order-btn"
            disabled={loading}
          >
            {loading ? 'Placing Order...' : 'Place Order'}
          </button>

          <button
            onClick={confirmClear}
            className="clear-cart-btn"
          >
            Clear Cart
          </button>
        </div>
      </div>
    </div>
  );
}

export default Cart;