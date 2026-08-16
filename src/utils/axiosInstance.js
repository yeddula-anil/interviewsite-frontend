import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

const axiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
});

// ✅ Request Interceptor — attach token
axiosInstance.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ✅ Response Interceptor — handle expired token
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('⚠️ Unauthorized — token expired or invalid');
      localStorage.removeItem('accessToken');
      window.location.href = '/auth/signin';
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
