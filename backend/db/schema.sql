-- GrabNGo Database Schema
-- Create database
CREATE DATABASE IF NOT EXISTS grabngo_db;
USE grabngo_db;

-- ==================== USERS TABLE ====================
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== CATEGORIES TABLE ====================
CREATE TABLE IF NOT EXISTS categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_is_active (is_active),
  INDEX idx_category_name (category_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== MENU ITEMS TABLE ====================
CREATE TABLE IF NOT EXISTS menu_items (
  item_id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT,
  item_name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  image_url VARCHAR(500),
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL,
  INDEX idx_category_id (category_id),
  INDEX idx_is_available (is_available),
  INDEX idx_item_name (item_name),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== ORDERS TABLE ====================
CREATE TABLE IF NOT EXISTS orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount > 0),
  payment_method VARCHAR(50) NOT NULL,
  payment_status ENUM('pending', 'paid', 'refunded') NOT NULL DEFAULT 'pending',
  status ENUM('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  special_instructions TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_order_number (order_number),
  INDEX idx_status (status),
  INDEX idx_payment_status (payment_status),
  INDEX idx_created_at (created_at),
  INDEX idx_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== ORDER ITEMS TABLE ====================
CREATE TABLE IF NOT EXISTS order_items (
  order_item_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price > 0),
  subtotal DECIMAL(12, 2) NOT NULL CHECK (subtotal > 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES menu_items(item_id) ON DELETE RESTRICT,
  INDEX idx_order_id (order_id),
  INDEX idx_item_id (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== AUDIT LOG TABLE ====================
CREATE TABLE IF NOT EXISTS audit_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== SAMPLE DATA ====================

-- Insert sample categories
INSERT INTO categories (category_name, description, is_active) VALUES
('Burgers', 'Delicious handcrafted burgers', TRUE),
('Pizza', 'Wood-fired pizzas with fresh ingredients', TRUE),
('Salads', 'Fresh and healthy salads', TRUE),
('Beverages', 'Soft drinks, juices, and coffee', TRUE),
('Desserts', 'Sweet treats and pastries', TRUE);

-- Insert sample menu items
INSERT INTO menu_items (category_id, item_name, description, price, is_available) VALUES
(1, 'Classic Burger', 'Beef patty with lettuce, tomato, and onion', 8.99, TRUE),
(1, 'Cheese Burger', 'Classic burger with melted cheddar cheese', 9.99, TRUE),
(1, 'Bacon Burger', 'Beef patty with crispy bacon and Swiss cheese', 10.99, TRUE),
(2, 'Margherita Pizza', 'Fresh mozzarella, basil, and tomato sauce', 11.99, TRUE),
(2, 'Pepperoni Pizza', 'Classic pepperoni with extra cheese', 12.99, TRUE),
(3, 'Caesar Salad', 'Crispy romaine with parmesan and croutons', 7.99, TRUE),
(3, 'Greek Salad', 'Fresh vegetables with feta cheese', 8.99, TRUE),
(4, 'Iced Coffee', 'Cold brew coffee with ice', 3.99, TRUE),
(4, 'Fresh Juice', 'Orange or apple juice', 2.99, TRUE),
(5, 'Chocolate Cake', 'Rich chocolate cake with frosting', 4.99, TRUE);

-- Insert sample admin user (password: Admin@12345)
INSERT INTO users (username, email, password_hash, full_name, phone, role, is_active) VALUES
('admin', 'admin@grabngo.com', '$2b$10$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5YmMxSUaqvPXm', 'Admin User', '1234567890', 'admin', TRUE);

-- Insert sample staff user (password: Staff@12345)
INSERT INTO users (username, email, password_hash, full_name, phone, role, is_active) VALUES
('staff1', 'staff@grabngo.com', '$2b$10$vKWXNhLF5Gl6z.xfS87VXOnJ8ItHcQ6nFCPaKzjy6n8dAqNQPLzgu', 'Staff Member', '0987654321', 'staff', TRUE);

-- Insert sample customer user (password: Customer@12345)
INSERT INTO users (username, email, password_hash, full_name, phone, role, is_active) VALUES
('customer1', 'customer@grabngo.com', '$2b$10$gO4vbQQb.TfPKGfm0YKX5.6.2h5vr8j7wPJb0bJ5nPQhO4KPGM8Ee', 'John Doe', '5555555555', 'customer', TRUE);

-- Insert sample orders
INSERT INTO orders (user_id, order_number, total_amount, payment_method, payment_status, status, special_instructions, created_at) VALUES
(3, 'ORD1700000001', 19.98, 'credit_card', 'paid', 'completed', 'No onions please', NOW() - INTERVAL 7 DAY),
(3, 'ORD1700000002', 15.99, 'cash', 'pending', 'ready', NULL, NOW() - INTERVAL 3 DAY),
(3, 'ORD1700000003', 23.97, 'credit_card', 'paid', 'preparing', 'Extra sauce on the side', NOW());

-- Insert sample order items
INSERT INTO order_items (order_id, item_id, quantity, unit_price, subtotal) VALUES
(1, 1, 2, 8.99, 17.98),
(1, 9, 1, 2.99, 2.99),
(2, 2, 1, 9.99, 9.99),
(2, 10, 1, 4.99, 4.99),
(3, 5, 1, 12.99, 12.99),
(3, 7, 1, 8.99, 8.99);

-- ==================== STORED PROCEDURES ====================

-- Procedure to get order summary
DELIMITER //

CREATE PROCEDURE GetOrderSummary(IN orderId INT)
BEGIN
  SELECT 
    o.order_id,
    o.order_number,
    o.total_amount,
    o.status,
    o.payment_status,
    o.created_at,
    u.username,
    u.full_name,
    COUNT(oi.order_item_id) as item_count
  FROM orders o
  LEFT JOIN users u ON o.user_id = u.user_id
  LEFT JOIN order_items oi ON o.order_id = oi.order_id
  WHERE o.order_id = orderId
  GROUP BY o.order_id;
END //

-- Procedure to get daily sales
CREATE PROCEDURE GetDailySales(IN saleDate DATE)
BEGIN
  SELECT 
    DATE(created_at) as sale_date,
    COUNT(DISTINCT order_id) as total_orders,
    COUNT(DISTINCT user_id) as unique_customers,
    SUM(total_amount) as total_revenue,
    AVG(total_amount) as avg_order_value
  FROM orders
  WHERE DATE(created_at) = saleDate AND status = 'completed';
END //

-- Procedure to get top selling items
CREATE PROCEDURE GetTopSellingItems(IN limitCount INT)
BEGIN
  SELECT 
    mi.item_id,
    mi.item_name,
    SUM(oi.quantity) as total_quantity_sold,
    SUM(oi.subtotal) as total_revenue,
    COUNT(DISTINCT oi.order_id) as times_ordered
  FROM order_items oi
  JOIN menu_items mi ON oi.item_id = mi.item_id
  GROUP BY mi.item_id
  ORDER BY total_quantity_sold DESC
  LIMIT limitCount;
END //

DELIMITER ;

-- ==================== VIEWS ====================

-- View for recent orders with customer info
CREATE OR REPLACE VIEW vw_recent_orders AS
SELECT 
  o.order_id,
  o.order_number,
  o.total_amount,
  o.status,
  o.payment_status,
  o.created_at,
  u.user_id,
  u.username,
  u.full_name,
  u.email,
  COUNT(oi.order_item_id) as item_count
FROM orders o
LEFT JOIN users u ON o.user_id = u.user_id
LEFT JOIN order_items oi ON o.order_id = oi.order_id
GROUP BY o.order_id
ORDER BY o.created_at DESC;

-- View for available menu items
CREATE OR REPLACE VIEW vw_available_menu AS
SELECT 
  mi.item_id,
  mi.item_name,
  mi.description,
  mi.price,
  mi.image_url,
  c.category_id,
  c.category_name
FROM menu_items mi
LEFT JOIN categories c ON mi.category_id = c.category_id
WHERE mi.is_available = TRUE AND c.is_active = TRUE;

-- ==================== CREDENTIALS FOR TESTING ====================
/*
Sample Login Credentials:

ADMIN USER:
  Username: admin
  Email: admin@grabngo.com
  Password: Admin@12345
  Role: admin


CUSTOMER USER:
  Username: customer1
  Email: customer@grabngo.com
  Password: Customer@12345
  Role: customer

Note: Passwords are hashed using bcrypt (salt rounds: 10)
Generated with: bcrypt.hash(password, 10)
*/