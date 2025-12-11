// server.js - Main Express Server
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');

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

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('CRITICAL: JWT_SECRET must be set in .env file');
  process.exit(1);
}

const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3001';
const NODE_ENV = process.env.NODE_ENV || 'development';

app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.set('trust proxy', 1);

app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

if (NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
      return res.redirect('https://' + req.get('host') + req.url);
    }
    next();
  });
}


app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); 
  next();
});


const UPLOADS_ROOT = path.join(__dirname, 'uploads');


app.use('/uploads', express.static(UPLOADS_ROOT));

const UPLOAD_DEST = path.join(__dirname, 'uploads', 'menu');


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

const handleError = (err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`, err.stack);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(UPLOAD_DEST)) {
            fs.mkdirSync(UPLOAD_DEST, { recursive: true });
        }
        cb(null, UPLOAD_DEST);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = /jpeg|jpg|png|gif/;
        const isValid = allowedMimeTypes.test(file.mimetype);
        if (isValid) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, PNG, GIF) are allowed'), false); 
        }
    }
});

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

// FIX 1: Convert pool to PromisePool by adding .promise()
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
}).promise(); // CRITICAL FIX: Use promise interface

// FIX 2: Convert initial connection check to promise style
db.getConnection()
  .then(connection => {
    console.log('[DB] ✓ Database connected successfully');
    connection.release();
  })
  .catch(err => {
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
  });


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

// FIX 3: Converted to async/await
// FIX 8: Converted to async/await (Updated to correctly fetch and emit image_url + ADDED DEBUG LOG)
app.post('/api/menu', authenticateToken, requireRole('admin'), validateMenuItem, handleValidationErrors, async (req, res, next) => {
  try {
    const { category_id, item_name, description, price, image_url, is_available } = req.body;
    
    // DEBUG: Log the received image URL before insertion
    console.log('[MENU POST] Received data. Item:', item_name, 'Image URL:', image_url);
    
    const insertQuery = `
      INSERT INTO menu_items (category_id, item_name, description, price, image_url, is_available, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;
    
    // 1. Insert the new item
    const [insertResult] = await db.query(insertQuery, [
      category_id || null, 
      item_name, 
      description || null, 
      price, 
      image_url || null, // Insert the image_url (or null if empty/missing)
      is_available ? 1 : 0
    ]);
    
    const newId = insertResult.insertId;
    
    // 2. Fetch the newly created item's complete data from the database
    const fetchQuery = `
      SELECT mi.*, c.category_name
      FROM menu_items mi
      LEFT JOIN categories c ON mi.category_id = c.category_id
      WHERE mi.item_id = ?
    `;
    
    const [rows] = await db.query(fetchQuery, [newId]); 
    
    if (rows.length === 0) {
      console.error(`[DB] Failed to retrieve newly inserted item ID: ${newId}`);
      return res.status(500).json({ error: 'Item created but failed to retrieve details.' });
    }
    
    const newItem = rows[0];
    
    // 3. Emit the complete newItem object to clients
    try {
      io.to('admins').emit('menu:item:add', newItem);
      io.to('customers').emit('menu:item:add', newItem);
    } catch (_e) {
      console.warn('[SOCKET] Failed to emit menu:item:add');
    }
    
    // 4. Respond with the successfully created item
    res.status(201).json({ message: 'Menu item added successfully', item: newItem });
  } catch (error) {
    console.error('[DB] Menu item creation error:', error.message);
    next(error);
  }
});

// Final corrected POST /api/menu route
app.post('/api/menu', authenticateToken, requireRole('admin'), validateMenuItem, handleValidationErrors, async (req, res, next) => {
  try {
    const { category_id, item_name, description, price, image_url, is_available } = req.body;
    
    // Convert empty string/undefined URL to NULL for DB insertion
    const final_image_url = (image_url && image_url.trim().length > 0) ? image_url : null;

    // DEBUG: Log the *final* value being inserted
    console.log('[MENU POST] Final Image URL for DB:', final_image_url);
    
    const insertQuery = `
      INSERT INTO menu_items (category_id, item_name, description, price, image_url, is_available, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;
    
    // 1. Insert the new item
    const [insertResult] = await db.query(insertQuery, [
      category_id || null, 
      item_name, 
      description || null, 
      price, 
      final_image_url, 
      is_available ? 1 : 0
    ]);
    
    const newId = insertResult.insertId;
    
    // 2. Fetch the newly created item's complete data from the database
    const fetchQuery = `
      SELECT mi.*, c.category_name
      FROM menu_items mi
      LEFT JOIN categories c ON mi.category_id = c.category_id
      WHERE mi.item_id = ?
    `;
    
    const [rows] = await db.query(fetchQuery, [newId]); 
    
    if (rows.length === 0) {
      console.error(`[DB] Failed to retrieve newly inserted item ID: ${newId}`);
      return res.status(500).json({ error: 'Item created but failed to retrieve details.' });
    }
    
    const newItem = rows[0];
    
    // 3. Emit the complete newItem object to clients
    try {
      io.to('admins').emit('menu:item:add', newItem);
      io.to('customers').emit('menu:item:add', newItem);
    } catch (_e) {
      console.warn('[SOCKET] Failed to emit menu:item:add');
    }
    
    res.status(201).json({ message: 'Menu item added successfully', item: newItem });
  } catch (error) {
    console.error('[DB] Menu item creation error:', error.message);
    next(error);
  }
});

// FIX 5: Converted to async/await
app.get('/api/auth/me', authenticateToken, async (req, res, next) => {
  try {
    const query = 'SELECT user_id, username, email, full_name, phone, role FROM users WHERE user_id = ?';
    const [results] = await db.query(query, [req.user.userId]); // AWAIT

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
  } catch (err) {
    console.error('[DB] Profile fetch error:', err.message);
    next(err);
  }
});
// FIX 20: Add the missing POST /api/auth/login route
app.post('/api/auth/login', authLimiter, validateLogin, handleValidationErrors, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    // 1. Fetch user by username (FIX: Alias 'password' to 'password_hash')
const [rows] = await db.query('SELECT user_id, username, password AS password_hash, role FROM users WHERE username = ?', [username]);
    
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const user = rows[0];
    
    // 2. Compare password hash (assuming your column is named password_hash)
    // If you use a different column name (e.g., just 'password'), update it here
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // 3. Generate JWT token
    const token = jwt.sign(
      { userId: user.user_id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: { userId: user.user_id, username: user.username, role: user.role }
    });
  } catch (err) {
    console.error('[DB] Login error:', err.message);
    next(err);
  }
});

app.post('/api/upload/image', authenticateToken, requireRole('admin'), upload.single('image'), (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const filename = req.file.filename;

    const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const host = req.get('host');
    
    const fileUrl = `${protocol}://${host}/uploads/menu/${filename}`;

    res.json({
      message: 'File uploaded successfully',
      imageUrl: fileUrl,
      fileName: filename
    });
  } catch (error) {
    console.error('[UPLOAD] Error:', error.message);
    next(error);
  }
});


// FIX 6: Converted to async/await (The route that was causing the callback error)
app.get('/api/menu', async (req, res, next) => {
  try {
    const query = `
      SELECT mi.*, c.category_name
      FROM menu_items mi
      LEFT JOIN categories c ON mi.category_id = c.category_id
      WHERE mi.is_available = TRUE
      ORDER BY c.category_name, mi.item_name
    `;
    
    const [results] = await db.query(query); // AWAIT

    res.json(results);
  } catch (err) {
    console.error('[DB] Menu fetch error:', err.message);
    next(err);
  }
});

// FIX 7: Converted to async/await
app.get('/api/menu/:id', async (req, res, next) => {
  const itemId = parseInt(req.params.id);
  if (isNaN(itemId)) {
    return res.status(400).json({ error: 'Invalid item ID' });
  }
  
  try {
    const query = 'SELECT * FROM menu_items WHERE item_id = ?';
    const [results] = await db.query(query, [itemId]); // AWAIT
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    res.json(results[0]);
  } catch (err) {
    console.error('[DB] Menu item fetch error:', err.message);
    next(err);
  }
});

// FIX 8: Converted to async/await
app.post('/api/menu', authenticateToken, requireRole('admin'), validateMenuItem, handleValidationErrors, async (req, res, next) => {
  try {
    const { category_id, item_name, description, price, image_url, is_available } = req.body;
    
    const insertQuery = `
      INSERT INTO menu_items (category_id, item_name, description, price, image_url, is_available, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;
    
    const [insertResult] = await db.query(insertQuery, [category_id || null, item_name, description || null, price, image_url || null, is_available ? 1 : 0]); // AWAIT 1
    
    const newId = insertResult.insertId;
    const fetchQuery = `
      SELECT mi.*, c.category_name
      FROM menu_items mi
      LEFT JOIN categories c ON mi.category_id = c.category_id
      WHERE mi.item_id = ?
    `;
    
    const [rows] = await db.query(fetchQuery, [newId]); // AWAIT 2
    const newItem = rows && rows[0] ? rows[0] : { item_id: newId, item_name, category_id, description, price, image_url, is_available: is_available ? 1 : 0 };
    
    try {
      io.to('admins').emit('menu:item:add', newItem);
      io.to('customers').emit('menu:item:add', newItem);
    } catch (_e) {
      console.warn('[SOCKET] Failed to emit menu:item:add');
    }
    
    res.status(201).json({ message: 'Menu item added successfully', itemId: newId });
  } catch (error) {
    console.error('[DB] Menu item creation error:', error.message);
    next(error);
  }
});

// FIX 9: Converted to async/await and improved update logic
app.put('/api/menu/:id', authenticateToken, requireRole('admin'), validateMenuItem, handleValidationErrors, async (req, res, next) => {
  try {
    const itemId = parseInt(req.params.id);
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }
    
    const { category_id, item_name, description, price, is_available, image_url } = req.body;
    const safeAvailable = is_available !== undefined ? (is_available ? 1 : 0) : null;
    
    let updates = [];
    let params = [];

    if (category_id !== undefined) {
        updates.push('category_id = ?');
        params.push(category_id || null);
    }
    if (item_name !== undefined) {
        updates.push('item_name = ?');
        params.push(item_name);
    }
    if (description !== undefined) {
        updates.push('description = ?');
        params.push(description || null);
    }
    if (price !== undefined) {
        updates.push('price = ?');
        params.push(price);
    }
    if (safeAvailable !== null) {
        updates.push('is_available = ?');
        params.push(safeAvailable);
    }
    if (image_url !== undefined) {
        updates.push('image_url = ?');
        params.push(image_url || null);
    }
    
    if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(itemId);
    
    const updateQuery = `
      UPDATE menu_items
      SET ${updates.join(', ')}
      WHERE item_id = ?
    `;
    
    const [updateResult] = await db.query(updateQuery, params); // AWAIT 1
    
    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    
    const fetchQuery = `
      SELECT mi.*, c.category_name
      FROM menu_items mi
      LEFT JOIN categories c ON mi.category_id = c.category_id
      WHERE mi.item_id = ?
    `;
    
    const [rows] = await db.query(fetchQuery, [itemId]); // AWAIT 2
    const updated = rows && rows[0] ? rows[0] : { item_id: itemId, is_available: safeAvailable };
    
    try {
      io.to('admins').emit('menu:item:update', updated);
      io.to('customers').emit('menu:item:update', updated);
    } catch (_e) {
      console.warn('[SOCKET] Failed to emit menu:item:update');
    }
    
    res.json({ message: 'Menu item updated successfully', item: updated });
  } catch (error) {
    console.error('[DB] Menu item update error:', error.message);
    next(error);
  }
});

// FIX 10: Final corrected DELETE route with transaction and async/await
app.delete('/api/menu/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
  const itemId = parseInt(req.params.id);
  if (isNaN(itemId)) {
    return res.status(400).json({ error: 'Invalid item ID' });
  }

  let connection;
  try {
    // 1. Get a connection from the promise pool
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 2. Delete dependent rows in order_items (resolves foreign key constraint)
    const deleteOrderItemsQuery = 'DELETE FROM order_items WHERE item_id = ?';
    const [orderItemsResult] = await connection.execute(deleteOrderItemsQuery, [itemId]);
    console.log(`[DB] Deleted ${orderItemsResult.affectedRows} order item references for item ID ${itemId}.`);

    // 3. Delete the parent row in menu_items
    const deleteMenuItemQuery = 'DELETE FROM menu_items WHERE item_id = ?';
    const [menuItemResult] = await connection.execute(deleteMenuItemQuery, [itemId]);

    if (menuItemResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Menu item not found' });
    }

    // 4. Commit the transaction
    await connection.commit();

    // 5. Handle Socket and Response
    try {
      io.to('admins').emit('menu:item:delete', { item_id: itemId });
      io.to('customers').emit('menu:item:delete', { item_id: itemId });
    } catch (_e) {
      console.warn('[SOCKET] Failed to emit menu:item:delete');
    }

    res.json({ message: 'Menu item deleted successfully' });

  } catch (error) {
    if (connection) {
      // Rollback on any error, and catch rollback error to ensure main error is returned
      await connection.rollback().catch(rollbackError => {
        console.error('[DB] Rollback error:', rollbackError.message);
      });
    }
    console.error('[DB] Menu item deletion error:', error.message, error.code);
    next(error);

  } finally {
    if (connection) {
      connection.release(); // Ensure connection is released
    }
  }
});


// FIX 11: Converted to async/await
app.get('/api/categories', async (req, res, next) => {
  try {
    const query = 'SELECT * FROM categories WHERE is_active = TRUE ORDER BY category_name';
    const [results] = await db.query(query);
    res.json(results);
  } catch (err) {
    console.error('[DB] Categories fetch error:', err.message);
    next(err);
  }
});

// FIX 12: Converted to async/await
app.post('/api/categories', authenticateToken, requireRole('admin'), validateCategory, handleValidationErrors, async (req, res, next) => {
  try {
    const { category_name, is_active } = req.body;
    const active = is_active !== false ? 1 : 0;
    
    const insertQuery = 'INSERT INTO categories (category_name, is_active, created_at) VALUES (?, ?, NOW())';
    const [insertResult] = await db.query(insertQuery, [category_name, active]);

    const newId = insertResult.insertId;
    const [rows] = await db.query('SELECT * FROM categories WHERE category_id = ?', [newId]);
    const cat = rows && rows[0] ? rows[0] : { category_id: newId, category_name, is_active: active };
    
    try {
      io.to('admins').emit('category:add', cat);
    } catch (_e) {
      console.warn('[SOCKET] Failed to emit category:add');
    }
    
    res.status(201).json(cat);
  } catch (error) {
    console.error('[DB] Category creation error:', error.message);
    next(error);
  }
});

// FIX 13: Converted to async/await
app.put('/api/categories/:id', authenticateToken, requireRole('admin'), validateCategory, handleValidationErrors, async (req, res, next) => {
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
    const [updateResult] = await db.query(query, [...params, catId]); // AWAIT 1

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    const [rows] = await db.query('SELECT * FROM categories WHERE category_id = ?', [catId]); // AWAIT 2
    const cat = rows && rows[0] ? rows[0] : null;
    
    try {
      io.to('admins').emit('category:update', cat || { category_id: catId });
    } catch (_e) {
      console.warn('[SOCKET] Failed to emit category:update');
    }
    
    res.json(cat || { message: 'Category updated' });
  } catch (error) {
    console.error('[DB] Category update error:', error.message);
    next(error);
  }
});

// FIX 14: Converted to async/await transaction structure
app.post('/api/orders', authenticateToken, requireRole('customer'), orderLimiter, async (req, res, next) => {
  
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const { items, payment_method, special_instructions, order_type, scheduled_at } = req.body;
  const userId = req.user.userId;
  
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
  
  let connection;
  try {
    // 1. Get connection and begin transaction
    connection = await db.getConnection();
    await connection.beginTransaction();
    
    const orderQuery = `
      INSERT INTO orders (user_id, order_number, total_amount, payment_method, special_instructions, status, payment_status, order_type, scheduled_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    
    // 2. Insert order
    const [orderResult] = await connection.query(orderQuery, [userId, orderNumber, total, payment_method, special_instructions || null, ORDER_STATUS.PENDING, PAYMENT_STATUS.PENDING, finalOrderType, finalScheduledTime]);
    
    const orderId = orderResult.insertId;
    const orderItemsQuery = 'INSERT INTO order_items (order_id, item_id, quantity, unit_price, subtotal) VALUES ?';
    const orderItemsData = items.map(item => [orderId, item.item_id, item.quantity, item.price, item.price * item.quantity]);
    
    // 3. Insert order items
    await connection.query(orderItemsQuery, [orderItemsData]);
    
    // 4. Commit the transaction
    await connection.commit();
    
    // 5. Emit socket event
    try {
      io.to('admins').emit('order:new', {
        orderId,
        orderNumber,
        totalAmount: total,
        userId,
        username: req.user.username,
        orderType: finalOrderType,
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
    
  } catch (error) {
    if (connection) {
      // Rollback on any error
      await connection.rollback().catch(rollbackError => {
        console.error('[DB] Rollback error:', rollbackError.message);
      });
    }
    console.error('[DB] Order creation error:', error.message);
    next(error);

  } finally {
    if (connection) {
      connection.release();
    }
  }
});


// FIX 15: Converted to async/await
app.get('/api/orders/my-orders', authenticateToken, requireRole('customer'), async (req, res, next) => {
  try {
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
    
    const [results] = await db.query(query, [userId, limit, offset]);

    res.json({
      orders: results,
      page,
      limit,
      count: results.length
    });
  } catch (err) {
    console.error('[DB] User orders fetch error:', err.message);
    next(err);
  }
});

// FIX 16: Converted to async/await
app.get('/api/orders/:id', authenticateToken, requireRole('customer'), async (req, res, next) => {
  const orderId = parseInt(req.params.id);
  const userId = req.user.userId;
  
  if (isNaN(orderId)) {
    return res.status(400).json({ error: 'Invalid order ID' });
  }
  
  try {
    const query = `
      SELECT o.*, oi.order_item_id, oi.item_id, oi.quantity, oi.unit_price, oi.subtotal, mi.item_name, mi.image_url
      FROM orders o
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      LEFT JOIN menu_items mi ON oi.item_id = mi.item_id
      WHERE o.order_id = ? AND o.user_id = ?
    `;
    
    const [results] = await db.query(query, [orderId, userId]);
    
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
  } catch (err) {
    console.error('[DB] Order details fetch error:', err.message);
    next(err);
  }
});

// FIX 17: Converted to async/await
app.get('/api/admin/menu/order-counts', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const query = `
      SELECT 
        mi.item_id,
        mi.item_name,
        mi.image_url,
        c.category_name,
        SUM(oi.quantity) AS total_quantity_ordered
      FROM menu_items mi
      LEFT JOIN order_items oi ON mi.item_id = oi.item_id
      LEFT JOIN categories c ON mi.category_id = c.category_id
      GROUP BY mi.item_id, mi.item_name, mi.image_url, c.category_name
      ORDER BY total_quantity_ordered DESC, mi.item_name ASC
    `;

    const [results] = await db.query(query);

    res.json(results);
  } catch (err) {
    console.error('[DB] Item order counts fetch error:', err.message);
    next(err);
  }
});

// FIX 18: Converted to async/await
app.get('/api/admin/orders', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
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
    
    const [results] = await db.query(query, [limit, offset]);
    
    res.json({
      orders: results,
      page,
      limit,
      count: results.length
    });
  } catch (err) {
    console.error('[DB] Admin orders fetch error:', err.message);
    next(err);
  }
});

// FIX 19: Converted to async/await
app.get('/api/admin/orders/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
  const orderId = parseInt(req.params.id);
  
  if (isNaN(orderId)) {
    return res.status(400).json({ error: 'Invalid order ID' });
  }
  
  try {
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
        COALESCE(oi.item_name_snapshot, mi.item_name) AS item_name, 
        mi.image_url,
        mi.description
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.user_id
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      LEFT JOIN menu_items mi ON oi.item_id = mi.item_id
      WHERE o.order_id = ?
    `;
    
    const [results] = await db.query(query, [orderId]);

    if (results.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const orderData = results[0];
    
    const items = results
      .filter(r => r.order_item_id !== null)
      .map(r => {
        const safeQuantity = parseInt(r.quantity) || 0;
        const safeUnitPrice = parseFloat(r.unit_price) || 0.00;
        const safeSubtotal = parseFloat(r.subtotal) || (safeQuantity * safeUnitPrice);

        const safeItemName = r.item_name || `Item Not Found (ID: ${r.item_id})`;
        const safeDescription = r.description || 'No description available.'; 
        
        return {
          order_item_id: r.order_item_id,
          item_id: r.item_id,
          item_name: safeItemName,
          description: safeDescription,
          quantity: safeQuantity, 
          price: safeUnitPrice,
          subtotal: safeSubtotal,
          image_url: r.image_url
        };
      });
    
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
  } catch (err) {
    console.error('[DB] Admin order details error:', err.message);
    next(err);
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(handleError);


const PORT = process.env.PORT || 5000;
http.listen(PORT, () => {
  console.log(`
      Server running on port ${PORT}
      Environment: ${NODE_ENV}
  `);
});