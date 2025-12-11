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

export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  getCurrentUser: () => api.get('/auth/me'),
};

export const menuAPI = {
  getAllItems: () => api.get('/menu'),
  getItemById: (id) => api.get(`/menu/${id}`),

  uploadImage: (imageFormData) => {
    return api.post('/upload/image', imageFormData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  addItem: (itemData) => api.post('/menu', itemData),
  updateItem: (id, itemData) => api.put(`/menu/${id}`, itemData),
  deleteItem: (id) => api.delete(`/menu/${id}`),
};

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
  
  getOrderDetails: async (orderId) => {
    try {
      const response = await api.get(`/admin/orders/${orderId}`);
      return response;
    } catch (error) {
      console.error(`Failed to fetch order ${orderId} details:`, error);
      throw error;
    }
  },

  // NEW FUNCTION: Fetch total quantities ordered for all menu items
  getItemOrderCounts: () => api.get('/admin/menu/order-counts'),
};