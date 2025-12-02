import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ==================== AUTH ====================
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  getCurrentUser: () => api.get('/auth/me'),
};

// ==================== MENU ====================
export const menuAPI = {
  getAllItems: () => api.get('/menu'),
  getItemById: (id) => api.get(`/menu/${id}`),
  
  addItem: (itemData) => {
    // Validate required fields
    if (!itemData.item_name || !itemData.price) {
      return Promise.reject(new Error('Item name and price are required'));
    }
    
    // Ensure price is a number
    const price = typeof itemData.price === 'string' ? parseFloat(itemData.price) : itemData.price;
    if (isNaN(price)) {
      return Promise.reject(new Error('Price must be a valid number'));
    }
    
    const payload = {
      item_name: itemData.item_name.trim(),
      category_id: itemData.category_id ? Number(itemData.category_id) : null,
      description: itemData.description?.trim() || null,
      price: price,
      image_url: itemData.image_url?.trim() || null,
      is_available: itemData.is_available !== false
    };
    
    console.log('Sending menu item:', payload);
    return api.post('/menu', payload);
  },
  
  updateItem: (id, itemData) => {
    const price = typeof itemData.price === 'string' ? parseFloat(itemData.price) : itemData.price;
    
    const payload = {
      item_name: itemData.item_name.trim(),
      category_id: itemData.category_id ? Number(itemData.category_id) : null,
      description: itemData.description?.trim() || null,
      price: price,
      image_url: itemData.image_url?.trim() || null,
      is_available: itemData.is_available !== false
    };
    
    return api.put(`/menu/${id}`, payload);
  },
  
  deleteItem: (id) => api.delete(`/menu/${id}`),
};

// ==================== CATEGORIES ====================
export const categoryAPI = {
  getAllCategories: () => api.get('/categories'),
  
  addCategory: (categoryData) => {
    if (!categoryData.category_name?.trim()) {
      return Promise.reject(new Error('Category name is required'));
    }
    
    return api.post('/categories', {
      category_name: categoryData.category_name.trim(),
      is_active: categoryData.is_active !== false
    });
  },
  
  updateCategory: (id, categoryData) => {
    const payload = {
      category_name: categoryData.category_name?.trim(),
      is_active: categoryData.is_active !== false
    };
    
    return api.put(`/categories/${id}`, payload);
  },
};

// ==================== ORDERS ====================
export const orderAPI = {
  createOrder: (orderData) => api.post('/orders', orderData),
  
  getMyOrders: async (page = 1) => {
    try {
      const response = await api.get(`/orders/my-orders?page=${page}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      throw error;
    }
  },
  
  getOrderById: (id) => api.get(`/orders/${id}`),
};

// ==================== ADMIN API ====================
export const adminAPI = {
  getAllOrders: async (page = 1) => {
    try {
      const response = await api.get(`/admin/orders?page=${page}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch admin orders:', error);
      throw error;
    }
  },
  
  // NEW: Get detailed order information including items
  getOrderDetails: async (orderId) => {
    try {
      const response = await api.get(`/admin/orders/${orderId}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      throw error;
    }
  },
  
  updateOrderStatus: (id, payload) => api.put(`/admin/orders/${id}/status`, payload),
};

export default api;