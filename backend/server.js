// server.js - Main Express Server (Security Hardened - DIAGNOSTIC)
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');

// ==================== CONSTANTS ==================== 
const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  READY: 'ready',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  REFUNDED: 'refunded'
};

// ==================== CONFIGURATION ====================
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('CRITICAL: JWT_SECRET must be set in .env file');
  process.exit(1);
}

const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3001';
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log(`[CONFIG] Environment: ${NODE_ENV}`);
console.log(`[CONFIG] Allowed Origin: ${allowedOrigin}`);

// ==================== MIDDLEWARE ====================
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// HTTPS enforcement in production
if (NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
      return res.redirect('https://' + req.get('host') + req.url);
    }
    next();
  });
}

// ==================== RATE LIMITING ====================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: false
});

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: 'Too many order requests, please try again later'
});

app.use(limiter);

// ==================== REQUEST LOGGING ====================
const requestLogger = (req, res, next) => {
  req.startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    const logLevel = res.statusCode >= 400 ? 'ERROR' : 'INFO';
    console.log(`[${logLevel}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
};
app.use(requestLogger);

// ==================== ERROR HANDLER ====================
const handleError = (err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`, err.stack);
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
};

// ==================== SOCKET.IO ====================
const io = new Server(http, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type']
  }
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.warn(`[SECURITY] Invalid socket token from ${socket.handshake.address}`);
      return next(new Error('Authentication error: Invalid token'));
    }
    
    if (!user.userId || !user.username || !user.role) {
      return next(new Error('Authentication error: Invalid token payload'));
    }
    
    socket.user = user;
    next();
  });
});

io.on('connection', (socket) => {
  console.log(`[SOCKET] User ${socket.user.userId} connected`);
  
  const role = socket.user.role;
  
  if (role === 'admin') {
    socket.join('admins');
  } else {
    socket.join('customers');
  }
  
  socket.join(`user:${socket.user.userId}`);
  
  socket.on('cart:add', (payload) => {
    if (!payload || typeof payload !== 'object') {
      console.warn(`[SECURITY] Invalid cart:add payload from user ${socket.user.userId}`);
      return;
    }
    
    const { item } = payload;
    if (!item || typeof item !== 'object' || !Number.isInteger(item.item_id)) {
      console.warn(`[SECURITY] Malformed item data from user ${socket.user.userId}`);
      return;
    }
    
    io.to('admins').emit('cart:activity', {
      type: 'cart_add',
      userId: socket.user.userId,
      username: socket.user.username,
      item: {
        item_id: item.item_id,
        quantity: Number.isInteger(item.quantity) ? item.quantity : 1
      },
      at: Date.now()
    });
  });
  
  socket.on('disconnect', () => {
    console.log(`[SOCKET] User ${socket.user.userId} disconnected`);
  });
});

// ==================== DATABASE ====================
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'grabngo_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0
});

db.getConnection((err, connection) => {
  if (err) {
    console.error('[DB ERROR]', err.message);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('DATABASE CONNECTION WAS CLOSED');
    }
    if (err.code === 'ER_CON_COUNT_ERROR') {
      console.error('DATABASE HAS TOO MANY CONNECTIONS');
    }
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('DATABASE ACCESS WAS DENIED - CHECK CREDENTIALS');
    }
  } else {
    console.log('[DB] ✓ Database connected successfully');
    connection.release();
  }
});

// ==================== VALIDATION SCHEMAS ====================
const validateRegister = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be 3-20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
    .withMessage('Password must contain: Uppercase, lowercase, number, and special char (!@#$%^&*)'),
  
  body('full_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be 2-100 characters'),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9\-\+\s]+$/)
    .withMessage('Invalid phone format')
];

const validateLogin = [
  body('username')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Username is required'),
  
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required')
];

const validateMenuItem = [
  body('item_name')
    .trim()
    .notEmpty()
    .withMessage('Item name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Item name must be 1-100 characters'),
  
  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .custom((value) => {
      const num = Number(value);
      if (isNaN(num) || num <= 0) {
        throw new Error('Price must be a valid number greater than 0');
      }
      return true;
    }),
  
  body('category_id')
    .optional()
    .custom((value) => {
      if (value && isNaN(Number(value))) {
        throw new Error('Invalid category ID');
      }
      return true;
    }),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  
  body('image_url')
    .optional()
    .trim(),
  
  body('is_available')
    .optional()
    .custom((value) => {
      if (value !== undefined && typeof value !== 'boolean') {
        throw new Error('is_available must be a boolean');
      }
      return true;
    })
];

const validateCategory = [
  body('category_name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Category name required (1-100 chars)'),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be boolean')
];

// Validation result handler middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('[VALIDATION] Errors:', errors.array());
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.param, message: e.msg }))
    });
  }
  next();
};

// ==================== AUTHENTICATION MIDDLEWARE ====================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    console.warn('[AUTH] No token provided');
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.warn(`[AUTH] Invalid token: ${err.message}`);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    console.warn(`[AUTH] Access denied for role: ${req.user?.role || 'unknown'}`);
    return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
  }
  next();
};

// ==================== AUTH ROUTES ====================

// Register User

app.post(
  '/api/auth/register',
  [
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['customer', 'admin']).optional().withMessage('Invalid role specified'), 
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { username, email, password, full_name, phone } = req.body;
    
    // 1. Determine the final role, defaulting to 'customer'
    const requestedRole = req.body.role;
    const finalRole = requestedRole === 'admin' ? 'admin' : 'customer';
    
    // Function to handle the actual user registration
    const executeRegistration = async (roleToInsert) => {
      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Use the correct column name 'password' in the INSERT query
        const query = `
          INSERT INTO users (username, email, password, full_name, phone, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;
        
        // The third value is the hashedPassword, which goes into the 'password' column
        db.query(query, [username, email, hashedPassword, full_name || null, phone || null, roleToInsert], (err, result) => {
          if (err) {
            console.error('[DB] Registration error:', err.message);
            if (err.code === 'ER_DUP_ENTRY') {
              return res.status(409).json({ error: 'Username or email already exists' });
            }
            return res.status(500).json({ error: 'Registration failed', details: err.message });
          }
          
          const userId = result.insertId;
          // Use the correct column name 'password' in the JWT token signing
          const token = jwt.sign({ user_id: userId, role: roleToInsert }, process.env.JWT_SECRET, { expiresIn: '1d' }); 
          
          console.log('[REGISTER] ✓ User registered:', username, 'as', roleToInsert);
          res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { user_id: userId, username, email, full_name, phone, role: roleToInsert }
          });
        });
      } catch (error) {
        // Handle bcrypt or other synchronous errors
        console.error('[AUTH] Sync Error during registration:', error);
        return res.status(500).json({ error: 'Internal server error during registration' });
      }
    };


    // 2. Admin limit check (only runs if finalRole is 'admin')
    if (finalRole === 'admin') {
      const countQuery = 'SELECT COUNT(*) AS admin_count FROM users WHERE role = ?';
      db.query(countQuery, ['admin'], (err, results) => {
        if (err) {
          console.error('[DB] Admin count check error:', err.message);
          return res.status(500).json({ error: 'Database error during admin limit check' });
        }
        
        const adminCount = results[0]?.admin_count || 0;
        
        if (adminCount >= 2) { 
          console.warn(`[REGISTER] Admin limit reached. Count: ${adminCount}`);
          return res.status(403).json({ 
            error: 'Admin registration failed: Maximum of 2 admin accounts allowed.' 
          });
        }
        
        // Proceed with admin registration
        executeRegistration(finalRole);
      });
    } else {
      // Proceed with customer registration
      executeRegistration(finalRole);
    }
  }
);
// Login User
app.post('/api/auth/login', authLimiter, validateLogin, handleValidationErrors, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    console.log('[LOGIN] Attempting login for:', username);
    
    
    const query = 'SELECT user_id, username, email, password, role, full_name FROM users WHERE username = ? OR email = ?'; 
    db.query(query, [username, username], async (err, results) => {
      if (err) {
        console.error('[DB] Login query error:', err.message);
        return res.status(500).json({ error: 'Login failed' });
      }
      
      if (results.length === 0) {
        console.warn('[LOGIN] User not found:', username);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const user = results[0];
      console.log('[LOGIN] User found:', user.username, 'Role:', user.role);
      
      try {
        // FIX 1: Add a check for the password column's existence
        if (!user.password) {
            console.warn('[LOGIN] Password hash missing for user:', username);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // FIX 2: Correctly reference the new database column name 'user.password'
        const validPassword = await bcrypt.compare(password, user.password); // <--- FIXED
        console.log('[LOGIN] Password comparison result:', validPassword);
        
        if (!validPassword) {
          console.warn('[LOGIN] Invalid password for user:', username);
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
          {
            userId: user.user_id,
            username: user.username,
            role: user.role
          },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
        
        console.log('[LOGIN] ✓ Login successful:', username);
        
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
      } catch (bcryptErr) {
        console.error('[LOGIN] Bcrypt error:', bcryptErr.message);
        return res.status(500).json({ error: 'Login failed - password comparison error' });
      }
    });
  } catch (error) {
    console.error('[LOGIN] Exception:', error.message);
    next(error);
  }
});

// Get current user profile
app.get('/api/auth/me', authenticateToken, (req, res, next) => {
  const query = 'SELECT user_id, username, email, full_name, phone, role FROM users WHERE user_id = ?';
  db.query(query, [req.user.userId], (err, results) => {
    if (err) {
      console.error('[DB] Profile fetch error:', err.message);
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
      role: u.role
    });
  });
});

// ==================== MENU ROUTES ====================

// Get All Menu Items
app.get('/api/menu', (req, res, next) => {
  const query = `
    SELECT mi.*, c.category_name
    FROM menu_items mi
    LEFT JOIN categories c ON mi.category_id = c.category_id
    WHERE mi.is_available = TRUE
    ORDER BY c.category_name, mi.item_name
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('[DB] Menu fetch error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch menu items' });
    }
    res.json(results);
  });
});

// Get Menu Item by ID
app.get('/api/menu/:id', (req, res, next) => {
  const itemId = parseInt(req.params.id);
  if (isNaN(itemId)) {
    return res.status(400).json({ error: 'Invalid item ID' });
  }
  
  const query = 'SELECT * FROM menu_items WHERE item_id = ?';
  db.query(query, [itemId], (err, results) => {
    if (err) {
      console.error('[DB] Menu item fetch error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch menu item' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    res.json(results[0]);
  });
});

// Add Menu Item (Admin only)
app.post('/api/menu', authenticateToken, requireRole('admin'), validateMenuItem, handleValidationErrors, (req, res, next) => {
  try {
    const { category_id, item_name, description, price, image_url, is_available } = req.body;
    
    const query = `
      INSERT INTO menu_items (category_id, item_name, description, price, image_url, is_available, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;
    
    db.query(query, [category_id || null, item_name, description || null, price, image_url || null, is_available ? 1 : 0], (err, result) => {
      if (err) {
        console.error('[DB] Menu item creation error:', err.message);
        return res.status(500).json({ error: 'Failed to add menu item' });
      }
      
      const newId = result.insertId;
      const fetchQuery = `
        SELECT mi.*, c.category_name
        FROM menu_items mi
        LEFT JOIN categories c ON mi.category_id = c.category_id
        WHERE mi.item_id = ?
      `;
      
      db.query(fetchQuery, [newId], (fErr, rows) => {
        const newItem = rows && rows[0] ? rows[0] : { item_id: newId, item_name, category_id, description, price, image_url, is_available: 1 };
        
        try {
          io.to('admins').emit('menu:item:add', newItem);
          io.to('customers').emit('menu:item:add', newItem);
        } catch (_e) {
          console.warn('[SOCKET] Failed to emit menu:item:add');
        }
        
        res.status(201).json({ message: 'Menu item added successfully', itemId: newId });
      });
    });
  } catch (error) {
    next(error);
  }
});

// Update Menu Item (Admin only)
app.put('/api/menu/:id', authenticateToken, requireRole('admin'), validateMenuItem, handleValidationErrors, (req, res, next) => {
  try {
    const itemId = parseInt(req.params.id);
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }
    
    const { category_id, item_name, description, price, is_available } = req.body;
    const safeAvailable = is_available ? 1 : 0;
    
    const query = `
      UPDATE menu_items
      SET category_id = ?, item_name = ?, description = ?, price = ?, is_available = ?, updated_at = NOW()
      WHERE item_id = ?
    `;
    
    db.query(query, [category_id || null, item_name, description || null, price, safeAvailable, itemId], (err, result) => {
      if (err) {
        console.error('[DB] Menu item update error:', err.message);
        return res.status(500).json({ error: 'Failed to update menu item' });
      }
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Menu item not found' });
      }
      
      const fetchQuery = `
        SELECT mi.*, c.category_name
        FROM menu_items mi
        LEFT JOIN categories c ON mi.category_id = c.category_id
        WHERE mi.item_id = ?
      `;
      
      db.query(fetchQuery, [itemId], (fErr, rows) => {
        const updated = rows && rows[0] ? rows[0] : { item_id: itemId, is_available: safeAvailable };
        
        try {
          io.to('admins').emit('menu:item:update', updated);
          io.to('customers').emit('menu:item:update', updated);
        } catch (_e) {
          console.warn('[SOCKET] Failed to emit menu:item:update');
        }
        
        res.json({ message: 'Menu item updated successfully', item: updated });
      });
    });
  } catch (error) {
    next(error);
  }
});

// Delete Menu Item (Admin only)
app.delete('/api/menu/:id', authenticateToken, requireRole('admin'), (req, res, next) => {
  try {
    const itemId = parseInt(req.params.id);
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }
    
    const query = 'DELETE FROM menu_items WHERE item_id = ?';
    db.query(query, [itemId], (err, result) => {
      if (err) {
        console.error('[DB] Menu item deletion error:', err.message);
        return res.status(500).json({ error: 'Failed to delete menu item' });
      }
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Menu item not found' });
      }
      
      try {
        io.to('admins').emit('menu:item:delete', { item_id: itemId });
        io.to('customers').emit('menu:item:delete', { item_id: itemId });
      } catch (_e) {
        console.warn('[SOCKET] Failed to emit menu:item:delete');
      }
      
      res.json({ message: 'Menu item deleted successfully' });
    });
  } catch (error) {
    next(error);
  }
});

// ==================== CATEGORY ROUTES ====================

// Get All Categories
app.get('/api/categories', (req, res, next) => {
  const query = 'SELECT * FROM categories WHERE is_active = TRUE ORDER BY category_name';
  db.query(query, (err, results) => {
    if (err) {
      console.error('[DB] Categories fetch error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch categories' });
    }
    res.json(results);
  });
});

// Create Category (Admin only)
app.post('/api/categories', authenticateToken, requireRole('admin'), validateCategory, handleValidationErrors, (req, res, next) => {
  try {
    const { category_name, is_active } = req.body;
    const active = is_active !== false ? 1 : 0;
    
    const query = 'INSERT INTO categories (category_name, is_active, created_at) VALUES (?, ?, NOW())';
    db.query(query, [category_name, active], (err, result) => {
      if (err) {
        console.error('[DB] Category creation error:', err.message);
        return res.status(500).json({ error: 'Failed to create category' });
      }
      
      const newId = result.insertId;
      db.query('SELECT * FROM categories WHERE category_id = ?', [newId], (fErr, rows) => {
        const cat = rows && rows[0] ? rows[0] : { category_id: newId, category_name, is_active: active };
        
        try {
          io.to('admins').emit('category:add', cat);
        } catch (_e) {
          console.warn('[SOCKET] Failed to emit category:add');
        }
        
        res.status(201).json(cat);
      });
    });
  } catch (error) {
    next(error);
  }
});

// Update Category (Admin only)
app.put('/api/categories/:id', authenticateToken, requireRole('admin'), validateCategory, handleValidationErrors, (req, res, next) => {
  try {
    const catId = parseInt(req.params.id);
    if (isNaN(catId)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }
    
    const { category_name, is_active } = req.body;
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
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    const query = `UPDATE categories SET ${updates.join(', ')}, updated_at = NOW() WHERE category_id = ?`;
    db.query(query, [...params, catId], (err, result) => {
      if (err) {
        console.error('[DB] Category update error:', err.message);
        return res.status(500).json({ error: 'Failed to update category' });
      }
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }
      
      db.query('SELECT * FROM categories WHERE category_id = ?', [catId], (fErr, rows) => {
        const cat = rows && rows[0] ? rows[0] : null;
        
        try {
          io.to('admins').emit('category:update', cat || { category_id: catId });
        } catch (_e) {
          console.warn('[SOCKET] Failed to emit category:update');
        }
        
        res.json(cat || { message: 'Category updated' });
      });
    });
  } catch (error) {
    next(error);
  }
});

// ==================== ORDER ROUTES ====================

// Create Order
app.post('/api/orders', authenticateToken, requireRole('customer'), orderLimiter, (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { items, payment_method, special_instructions,order_type, scheduled_at} = req.body;
    const userId = req.user.userId;
    
    // --- NEW: Validation for Scheduling ---
    let finalScheduledTime = null;
    const finalOrderType = order_type === 'scheduled' ? 'scheduled' : 'asap';

    if (finalOrderType === 'scheduled') {
      if (!scheduled_at) {
        return res.status(400).json({ error: 'Scheduled time is required for scheduled orders.' });
      }
      
      const orderDate = new Date(scheduled_at);
      const now = new Date();
      
      if (isNaN(orderDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format for scheduled time.' });
      }

      if (orderDate <= now) {
         return res.status(400).json({ error: 'Scheduled time must be in the future.' });
      }
      
      // Store as ISO string or MySQL datetime format
      finalScheduledTime = new Date(scheduled_at).toISOString().slice(0, 19).replace('T', ' ');
    }
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item' });
    }
    
    if (!payment_method || typeof payment_method !== 'string') {
      return res.status(400).json({ error: 'Payment method is required' });
    }
    
    for (const item of items) {
      if (!Number.isInteger(item.item_id) || !Number.isInteger(item.quantity) || !item.price) {
        return res.status(400).json({ error: 'Invalid item data' });
      }
      if (item.quantity < 1) {
        return res.status(400).json({ error: 'Item quantity must be at least 1' });
      }
    }
    
    const orderNumber = 'ORD' + Date.now();
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    db.getConnection((err, connection) => {
      if (err) {
        console.error('[DB] Connection error:', err.message);
        return res.status(500).json({ error: 'Database connection failed' });
      }
      
      connection.beginTransaction((err) => {
        if (err) {
          connection.release();
          console.error('[DB] Transaction start error:', err.message);
          return res.status(500).json({ error: 'Transaction failed' });
        }
        
        const orderQuery = `
          INSERT INTO orders (user_id, order_number, total_amount, payment_method, special_instructions, status, payment_status, order_type, scheduled_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        
        connection.query(orderQuery, [userId, orderNumber, total, payment_method, special_instructions || null, ORDER_STATUS.PENDING, PAYMENT_STATUS.PENDING, finalOrderType, finalScheduledTime], (err, orderResult) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              console.error('[DB] Order creation error:', err.message);
              res.status(500).json({ error: 'Failed to create order' });
            });
          }
          
          const orderId = orderResult.insertId;
          const orderItemsQuery = 'INSERT INTO order_items (order_id, item_id, quantity, unit_price, subtotal) VALUES ?';
          const orderItemsData = items.map(item => [orderId, item.item_id, item.quantity, item.price, item.price * item.quantity]);
          
          connection.query(orderItemsQuery, [orderItemsData], (err) => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                console.error('[DB] Order items creation error:', err.message);
                res.status(500).json({ error: 'Failed to add order items' });
              });
            }
            
            connection.commit((err) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  console.error('[DB] Transaction commit error:', err.message);
                  res.status(500).json({ error: 'Failed to complete order' });
                });
              }
              
              connection.release();
              
              try {
                io.to('admins').emit('order:new', {
                  orderId,
                  orderNumber,
                  totalAmount: total,
                  userId,
                  username: req.user.username,
                  orderType: finalOrderType, // Pass to socket
                  scheduledAt: finalScheduledTime,
                  at: Date.now()
                });
              } catch (_e) {
                console.warn('[SOCKET] Failed to emit order:new');
              }
              
              console.log(`[ORDER] New order ${orderNumber} created by user ${userId}`);
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
  } catch (error) {
    next(error);
  }
});

// Get User Orders
app.get('/api/orders/my-orders', authenticateToken, requireRole('customer'), (req, res, next) => {
  const userId = req.user.userId;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;
  
  const query = `
    SELECT o.*, COUNT(oi.order_item_id) as item_count
    FROM orders o
    LEFT JOIN order_items oi ON o.order_id = oi.order_id
    WHERE o.user_id = ?
    GROUP BY o.order_id
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `;
  
  db.query(query, [userId, limit, offset], (err, results) => {
    if (err) {
      console.error('[DB] User orders fetch error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch orders' });
    }
    res.json({
      orders: results,
      page,
      limit,
      count: results.length
    });
  });
});

// Get Order Details
app.get('/api/orders/:id', authenticateToken, requireRole('customer'), (req, res, next) => {
  const orderId = parseInt(req.params.id);
  const userId = req.user.userId;
  
  if (isNaN(orderId)) {
    return res.status(400).json({ error: 'Invalid order ID' });
  }
  
  const query = `
    SELECT o.*, oi.order_item_id, oi.item_id, oi.quantity, oi.unit_price, oi.subtotal, mi.item_name, mi.image_url
    FROM orders o
    LEFT JOIN order_items oi ON o.order_id = oi.order_id
    LEFT JOIN menu_items mi ON oi.item_id = mi.item_id
    WHERE o.order_id = ? AND o.user_id = ?
  `;
  
  db.query(query, [orderId, userId], (err, results) => {
    if (err) {
      console.error('[DB] Order details fetch error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch order details' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const orderData = results[0];
    const items = results
      .filter(r => r.order_item_id !== null)
      .map(r => ({
        orderItemId: r.order_item_id,
        itemId: r.item_id,
        quantity: r.quantity,
        unitPrice: r.unit_price,
        subtotal: r.subtotal,
        itemName: r.item_name,
        imageUrl: r.image_url
      }));
    
    res.json({
      orderId: orderData.order_id,
      orderNumber: orderData.order_number,
      totalAmount: orderData.total_amount,
      paymentMethod: orderData.payment_method,
      status: orderData.status,
      paymentStatus: orderData.payment_status,
      specialInstructions: orderData.special_instructions,
      createdAt: orderData.created_at,
      items
    });
  });
});

// ==================== ADMIN ROUTES ====================

// List all recent orders (Admin only)
app.get('/api/admin/orders', authenticateToken, requireRole('admin'), (req, res, next) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;
  
  const query = `
    SELECT o.order_id, o.order_number, o.total_amount, o.payment_method, o.status, o.payment_status, o.order_type, o.scheduled_at, o.created_at, u.user_id, u.username, u.full_name, COUNT(oi.order_item_id) AS item_count
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.user_id
    LEFT JOIN order_items oi ON o.order_id = oi.order_id
    GROUP BY o.order_id
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `;
  
  db.query(query, [limit, offset], (err, results) => {
    if (err) {
      console.error('[DB] Admin orders fetch error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch orders' });
    }
    
    res.json({
      orders: results,
      page,
      limit,
      count: results.length
    });
  });
});

// Get admin order details - UPDATED FOR MODAL (FIXED NaN ISSUE)
app.get('/api/admin/orders/:id', authenticateToken, requireRole('admin'), (req, res, next) => {
  const orderId = parseInt(req.params.id);
  
  if (isNaN(orderId)) {
    return res.status(400).json({ error: 'Invalid order ID' });
  }
  
  const query = `
    SELECT 
      o.order_id,
      o.order_number,
      o.total_amount,
      o.payment_method,
      o.status,
      o.payment_status,
      o.order_type,
      o.scheduled_at,
      o.special_instructions,
      o.created_at,
      o.updated_at,
      u.user_id,
      u.username,
      u.full_name,
      u.email,
      u.phone,
      oi.order_item_id,
      oi.item_id,
      oi.quantity,
      oi.unit_price,
      oi.subtotal,
      -- Select the snapshot name first, fall back to current name
      COALESCE(oi.item_name_snapshot, mi.item_name) AS item_name, 
      mi.image_url,
      mi.description  -- <--- CRITICAL: Fetching the description
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.user_id
    LEFT JOIN order_items oi ON o.order_id = oi.order_id
    LEFT JOIN menu_items mi ON oi.item_id = mi.item_id
    WHERE o.order_id = ?
  `;
  
  db.query(query, [orderId], (err, results) => {
    if (err) {
      console.error('[DB] Admin order details error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch order details' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const orderData = results[0];
    
    // Map items with robust null/NaN checks
    const items = results
      .filter(r => r.order_item_id !== null)
      .map(r => {
        // FIX for NaN: Ensure quantity and price are safe numbers
        const safeQuantity = parseInt(r.quantity) || 0;
        const safeUnitPrice = parseFloat(r.unit_price) || 0.00;
        const safeSubtotal = parseFloat(r.subtotal) || (safeQuantity * safeUnitPrice);

        // FIX for null name/description: Provide fallbacks
        const safeItemName = r.item_name || `Item Not Found (ID: ${r.item_id})`;
        const safeDescription = r.description || 'No description available.'; 
        
        return {
          order_item_id: r.order_item_id,
          item_id: r.item_id,
          item_name: safeItemName,
          description: safeDescription, // <--- Correctly mapped
          quantity: safeQuantity, 
          price: safeUnitPrice,
          subtotal: safeSubtotal,
          image_url: r.image_url
        };
      });
    
    // Calculate total item count
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    
    res.json({
      order_id: orderData.order_id,
      order_number: orderData.order_number,
      user_id: orderData.user_id,
      username: orderData.username,
      full_name: orderData.full_name,
      email: orderData.email,
      phone: orderData.phone,
      total_amount: orderData.total_amount,
      payment_method: orderData.payment_method,
      status: orderData.status,
      payment_status: orderData.payment_status,
      order_type: orderData.order_type,
      scheduled_at: orderData.scheduled_at,
      special_instructions: orderData.special_instructions,
      created_at: orderData.created_at,
      updated_at: orderData.updated_at,
      item_count: itemCount,
      items: items
    });
  });
});

// ==================== HEALTH CHECK ==================== 
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ==================== 404 HANDLER ====================
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ==================== ERROR HANDLER ====================
app.use(handleError);

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
http.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║      GrabNGo Server - Hardened           ║
║      Server running on port ${PORT}          ║
║      Environment: ${NODE_ENV}                 ║
╚══════════════════════════════════════════╝
  `);
});