// server.js - Main Express Server
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');

// Middleware
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3001';
app.use(cors({ origin: allowedOrigin, methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== SOCKET.IO (initialized early) ====================
const io = new Server(http, {
  cors: { origin: allowedOrigin, methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Authorization','Content-Type'] }
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next();
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return next();
    socket.user = user; // { userId, username, role }
    next();
  });
});

io.on('connection', (socket) => {
  const role = socket.user?.role;
  if (role === 'admin' || role === 'staff') {
    socket.join('admins');
  } else {
    socket.join('customers');
  }

  // Join per-user room for targeted events
  if (socket.user?.userId) {
    socket.join(`user:${socket.user.userId}`);
  }

  socket.on('cart:add', (payload) => {
    // Broadcast minimal activity to admins
    io.to('admins').emit('cart:activity', {
      type: 'cart_add',
      userId: socket.user?.userId || null,
      username: socket.user?.username || 'guest',
      item: payload?.item || null,
      at: Date.now(),
    });
  });
});

// Database Connection
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'grabngo_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
db.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Database connected successfully');
    connection.release();
  }
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'Gr@bNG0S3cr3t!2024#Jwt';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// ==================== AUTH ROUTES ====================

// Register User
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, full_name, phone, role } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // sanitize role; default to 'customer'
    const allowedRoles = new Set(['customer','admin','staff']);
    const finalRole = allowedRoles.has((role || '').toLowerCase()) ? (role || '').toLowerCase() : 'customer';

    const query = 'INSERT INTO users (username, email, password_hash, full_name, phone, role) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(query, [username, email, hashedPassword, full_name, phone, finalRole], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: 'Username or email already exists' });
        }
        return res.status(500).json({ error: 'Registration failed' });
      }
      res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login User
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  const query = 'SELECT * FROM users WHERE username = ? OR email = ?';
  db.query(query, [username, username], async (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Login failed' });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = results[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.user_id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      }
    });
  });
});

// Auth: current user profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const query = 'SELECT user_id, username, email, full_name, phone, role FROM users WHERE user_id = ?';
  db.query(query, [req.user.userId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const u = results[0];
    res.json({
      userId: u.user_id,
      username: u.username,
      email: u.email,
      fullName: u.full_name,
      phone: u.phone,
      role: u.role,
    });
  });
});

// ==================== MENU ROUTES ====================

// Get All Menu Items
app.get('/api/menu', (req, res) => {
  const query = `
    SELECT mi.*, c.category_name 
    FROM menu_items mi
    LEFT JOIN categories c ON mi.category_id = c.category_id
    WHERE mi.is_available = TRUE
    ORDER BY c.category_name, mi.item_name
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch menu items' });
    }
    res.json(results);
  });
});

// Get Menu Item by ID
app.get('/api/menu/:id', (req, res) => {
  const query = 'SELECT * FROM menu_items WHERE item_id = ?';
  db.query(query, [req.params.id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch menu item' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    res.json(results[0]);
  });
});

// Add Menu Item (Admin only)
app.post('/api/menu', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { category_id, item_name, description, price, image_url } = req.body;
  const safeCategoryId = Number(category_id) > 0 ? Number(category_id) : null;
  const safePrice = Number(String(price).replace(',', '.'));
  if (!item_name || Number.isNaN(safePrice)) {
    return res.status(400).json({ error: 'Invalid menu item data' });
  }
  const query = 'INSERT INTO menu_items (category_id, item_name, description, price, image_url) VALUES (?, ?, ?, ?, ?)';
  
  db.query(query, [safeCategoryId, item_name, description, safePrice, image_url], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to add menu item' });
    }
    const newId = result.insertId;
    const fetchQuery = `SELECT mi.*, c.category_name FROM menu_items mi LEFT JOIN categories c ON mi.category_id = c.category_id WHERE mi.item_id = ?`;
    db.query(fetchQuery, [newId], (fErr, rows) => {
      const newItem = rows && rows[0] ? rows[0] : { item_id: newId, item_name, category_id, description, price, image_url, is_available: 1 };
      try {
        io.to('admins').emit('menu:item:add', newItem);
        io.to('customers').emit('menu:item:add', newItem);
      } catch (_e) {}
      res.status(201).json({ message: 'Menu item added successfully', itemId: newId });
    });
  });
});

// Update Menu Item (Admin only)
app.put('/api/menu/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { category_id, item_name, description, price, is_available } = req.body;
  const safeCategoryId = Number(category_id) > 0 ? Number(category_id) : null;
  const safePrice = Number(price);
  const safeAvailable = is_available ? 1 : 0;
  if (!item_name || Number.isNaN(safePrice)) {
    return res.status(400).json({ error: 'Invalid menu item data' });
  }
  const query = 'UPDATE menu_items SET category_id = ?, item_name = ?, description = ?, price = ?, is_available = ? WHERE item_id = ?';
  
  db.query(query, [safeCategoryId, item_name, description, safePrice, safeAvailable, req.params.id], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to update menu item' });
    }
    const fetchQuery = `SELECT mi.*, c.category_name FROM menu_items mi LEFT JOIN categories c ON mi.category_id = c.category_id WHERE mi.item_id = ?`;
    db.query(fetchQuery, [req.params.id], (fErr, rows) => {
      const updated = rows && rows[0] ? rows[0] : null;
      try {
        io.to('admins').emit('menu:item:update', updated || { item_id: Number(req.params.id), is_available: safeAvailable });
        io.to('customers').emit('menu:item:update', updated || { item_id: Number(req.params.id), is_available: safeAvailable });
      } catch (_e) {}
      res.json({ message: 'Menu item updated successfully' });
    });
  });
});

// Delete Menu Item (Admin only)
app.delete('/api/menu/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const query = 'DELETE FROM menu_items WHERE item_id = ?';
  db.query(query, [req.params.id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete menu item' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    try {
      io.to('admins').emit('menu:item:delete', { item_id: Number(req.params.id) });
      io.to('customers').emit('menu:item:delete', { item_id: Number(req.params.id) });
    } catch (_e) {}
    res.json({ message: 'Menu item deleted successfully' });
  });
});

// ==================== ORDER ROUTES ====================

// Create Order
app.post('/api/orders', authenticateToken, (req, res) => {
  if (!req.user || req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Only customers can place orders' });
  }
  const { items, payment_method, special_instructions } = req.body;
  const userId = req.user.userId;

  // Generate order number
  const orderNumber = 'ORD' + Date.now();

  // Calculate total
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Start transaction
  db.getConnection((err, connection) => {
    if (err) {
      return res.status(500).json({ error: 'Database connection failed' });
    }

    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        return res.status(500).json({ error: 'Transaction failed' });
      }

      // Insert order
      const orderQuery = 'INSERT INTO orders (user_id, order_number, total_amount, payment_method, special_instructions) VALUES (?, ?, ?, ?, ?)';
      connection.query(orderQuery, [userId, orderNumber, total, payment_method, special_instructions], (err, orderResult) => {
        if (err) {
          return connection.rollback(() => {
            connection.release();
            res.status(500).json({ error: 'Failed to create order' });
          });
        }

        const orderId = orderResult.insertId;

        // Insert order items
        const orderItemsQuery = 'INSERT INTO order_items (order_id, item_id, quantity, unit_price, subtotal) VALUES ?';
        const orderItemsData = items.map(item => [
          orderId,
          item.item_id,
          item.quantity,
          item.price,
          item.price * item.quantity
        ]);

        connection.query(orderItemsQuery, [orderItemsData], (err) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ error: 'Failed to add order items' });
            });
          }

          connection.commit((err) => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                res.status(500).json({ error: 'Failed to complete order' });
              });
            }

            connection.release();
            // Notify admins in realtime about new order
            try {
              io.to('admins').emit('order:new', {
                orderId,
                orderNumber,
                totalAmount: total,
                userId,
                at: Date.now(),
              });
            } catch (_e) {}
            res.status(201).json({
              message: 'Order placed successfully',
              orderId,
              orderNumber,
              totalAmount: total
            });
          });
        });
      });
    });
  });
});

// Get User Orders
app.get('/api/orders/my-orders', authenticateToken, (req, res) => {
  if (!req.user || req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Only customers can view their orders' });
  }
  const query = `
    SELECT o.*, 
           COUNT(oi.order_item_id) as item_count
    FROM orders o
    LEFT JOIN order_items oi ON o.order_id = oi.order_id
    WHERE o.user_id = ?
    GROUP BY o.order_id
    ORDER BY o.created_at DESC
  `;
  
  db.query(query, [req.user.userId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch orders' });
    }
    res.json(results);
  });
});

// Get Order Details
app.get('/api/orders/:id', authenticateToken, (req, res) => {
  if (!req.user || req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Only customers can view order details' });
  }
  const query = `
    SELECT o.*, oi.*, mi.item_name, mi.image_url
    FROM orders o
    LEFT JOIN order_items oi ON o.order_id = oi.order_id
    LEFT JOIN menu_items mi ON oi.item_id = mi.item_id
    WHERE o.order_id = ? AND o.user_id = ?
  `;
  
  db.query(query, [req.params.id, req.user.userId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch order details' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(results);
  });
});

// ==================== CATEGORIES ROUTES ====================

// Get All Categories
app.get('/api/categories', (req, res) => {
  const query = 'SELECT * FROM categories WHERE is_active = TRUE';
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch categories' });
    }
    res.json(results);
  });
});

// Create Category (Admin/Staff only)
app.post('/api/categories', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return res.status(403).json({ error: 'Access denied' });
  }
  const { category_name, is_active } = req.body || {};
  if (!category_name || !category_name.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }
  const active = is_active ? 1 : 1;
  const query = 'INSERT INTO categories (category_name, is_active) VALUES (?, ?)';
  db.query(query, [category_name.trim(), active], (err, result) => {
    if (err) return res.status(500).json({ error: 'Failed to create category' });
    const newId = result.insertId;
    db.query('SELECT * FROM categories WHERE category_id = ?', [newId], (fErr, rows) => {
      const cat = rows && rows[0] ? rows[0] : { category_id: newId, category_name, is_active: active };
      try {
        io.to('admins').emit('category:add', cat);
      } catch (_e) {}
      res.status(201).json(cat);
    });
  });
});

// Update Category (Admin/Staff only)
app.put('/api/categories/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return res.status(403).json({ error: 'Access denied' });
  }
  const { category_name, is_active } = req.body || {};
  const updates = [];
  const params = [];
  if (typeof category_name === 'string' && category_name.trim()) {
    updates.push('category_name = ?');
    params.push(category_name.trim());
  }
  if (typeof is_active !== 'undefined') {
    updates.push('is_active = ?');
    params.push(is_active ? 1 : 0);
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  const query = `UPDATE categories SET ${updates.join(', ')} WHERE category_id = ?`;
  db.query(query, [...params, req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Failed to update category' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Category not found' });
    db.query('SELECT * FROM categories WHERE category_id = ?', [req.params.id], (fErr, rows) => {
      const cat = rows && rows[0] ? rows[0] : null;
      try {
        io.to('admins').emit('category:update', cat || { category_id: Number(req.params.id), is_active: is_active ? 1 : 0 });
      } catch (_e) {}
      res.json(cat || { message: 'Category updated' });
    });
  });
});

// ==================== ADMIN ROUTES ====================

// List all recent orders (Admin/Staff only)
app.get('/api/admin/orders', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return res.status(403).json({ error: 'Access denied' });
  }
  const query = `
    SELECT o.order_id, o.order_number, o.total_amount, o.payment_method, o.created_at,
           u.user_id, u.username, u.full_name,
           COUNT(oi.order_item_id) AS item_count
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.user_id
    LEFT JOIN order_items oi ON o.order_id = oi.order_id
    GROUP BY o.order_id
    ORDER BY o.created_at DESC
    LIMIT 100
  `;
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch orders' });
    }
    res.json(results);
  });
});

// Update order status/payment (Admin/Staff only)
app.put('/api/admin/orders/:id/status', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return res.status(403).json({ error: 'Access denied' });
  }
  const orderId = req.params.id;
  const { status, payment_status } = req.body || {};

  const allowedStatus = new Set(['pending','confirmed','preparing','ready','completed','cancelled']);
  const allowedPayment = new Set(['pending','paid','refunded']);

  const updates = [];
  const params = [];
  if (status && allowedStatus.has(status)) {
    updates.push('status = ?');
    params.push(status);
  }
  if (payment_status && allowedPayment.has(payment_status)) {
    updates.push('payment_status = ?');
    params.push(payment_status);
  }
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const query = `UPDATE orders SET ${updates.join(', ')} WHERE order_id = ?`;
  db.query(query, [...params, orderId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to update order' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const fetchQuery = 'SELECT order_id, user_id, order_number, status, payment_status, total_amount, created_at FROM orders WHERE order_id = ?';
    db.query(fetchQuery, [orderId], (fetchErr, rows) => {
      if (fetchErr || rows.length === 0) {
        return res.json({ message: 'Order updated' });
      }
      const o = rows[0];
      try {
        io.to('admins').emit('order:update', o);
        io.to(`user:${o.user_id}`).emit('order:update', o);
      } catch (_e) {}
      res.json({ message: 'Order updated', order: o });
    });
  });
});

// (socket.io initialized earlier)

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});