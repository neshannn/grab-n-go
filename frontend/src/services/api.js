import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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

export const authAPI = {
  register: (userData) => api.post('/api/auth/register', userData),
  login: (credentials) => api.post('/api/auth/login', credentials),
  getCurrentUser: () => api.get('/api/auth/me'),
};

export const menuAPI = {
  getAllItems: () => api.get('/api/menu'),
  getItemById: (id) => api.get(`/api/menu/${id}`),

  uploadImage: (imageFormData) => {
    return api.post('/api/upload/image', imageFormData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  addItem: (itemData) => api.post('/api/menu', itemData),
  updateItem: (id, itemData) => api.put(`/api/menu/${id}`, itemData),
  deleteItem: (id) => api.delete(`/api/menu/${id}`),
};

export const categoryAPI = {
  getAllCategories: () => api.get('/api/categories'),

  addCategory: (categoryData) => {
    if (!categoryData.category_name?.trim()) {
      return Promise.reject(new Error('Category name is required'));
    }
    
    return api.post('/api/categories', {
      category_name: categoryData.category_name.trim(),
      is_active: categoryData.is_active !== false
    });
  },
  
  updateCategory: (id, categoryData) => {
    const payload = {
      category_name: categoryData.category_name?.trim(),
      is_active: categoryData.is_active !== false
    };
    
    return api.put(`/api/categories/${id}`, payload);
  },
  getAllAdminCategories: () => api.get('/api/admin/categories'),
};

export const orderAPI = {
  createOrder: (orderData) => api.post('/api/orders', orderData),
  
  getMyOrders: async (page = 1) => {
    try {
      const response = await api.get(`/api/orders?page=${page}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      throw error;
    }
  },
  
  getOrderById: (id) => api.get(`/api/orders/${id}`),
};

export const adminAPI = {
  getAllOrders: async (page = 1) => {
    try {
      const response = await api.get(`/api/admin/orders?page=${page}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch admin orders:', error);
      throw error;
    }
  },
  
  getOrderDetails: async (orderId) => {
    try {
      const response = await api.get(`/api/admin/orders/${orderId}`);
      return response;
    } catch (error) {
      console.error(`Failed to fetch order ${orderId} details:`, error);
      throw error;
    }
  },
  updateOrderStatus: (id, statusData) => {
    return api.put(`/api/admin/orders/${id}`, statusData);
  },

  getItemOrderCounts: () => api.get('/api/admin/menu/order-counts'),
};