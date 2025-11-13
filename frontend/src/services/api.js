import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

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


export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
};

export const menuAPI = {
  getAllItems: () => api.get('/menu'),
  getItemById: (id) => api.get(`/menu/${id}`),
  addItem: (itemData) => api.post('/menu', itemData),
  updateItem: (id, itemData) => api.put(`/menu/${id}`, itemData),
  deleteItem: (id) => api.delete(`/menu/${id}`),
};


export const categoryAPI = {
  getAllCategories: () => api.get('/categories'),
};

export const orderAPI = {
  createOrder: (orderData) => api.post('/orders', orderData),
  getMyOrders: () => api.get('/orders/my-orders'),
  getOrderById: (id) => api.get(`/orders/${id}`),
};

// Admin API
export const adminAPI = {
  getAllOrders: () => api.get('/admin/orders'),
  updateOrderStatus: (id, payload) => api.put(`/admin/orders/${id}/status`, payload),
};

export default api;