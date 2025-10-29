import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`,
  withCredentials: true, // ✅ Send cookies for JWT/refresh
});

// Avoid multiple refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error = null) => {
  failedQueue.forEach(({ resolve, reject, originalRequest }) => {
    if (error) reject(error);
    else resolve(axiosInstance(originalRequest));
  });
  failedQueue = [];
};

// Separate Axios instance for refresh (to avoid recursion)
const refreshInstance = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`,
  withCredentials: true,
});

// ✅ Response Interceptor
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If unauthorized and not yet retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Avoid retrying refresh endpoint itself
      if (originalRequest.url.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (isRefreshing) {
        // Queue the request while refreshing
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, originalRequest });
        });
      }

      isRefreshing = true;

      try {
        // Try refreshing the access token
        await refreshInstance.post('/auth/refresh');
        isRefreshing = false;

        // Retry all queued requests
        processQueue();

        // Retry original failed request
        return axiosInstance(originalRequest);
      } catch (err) {
        isRefreshing = false;

        // Reject all queued requests
        processQueue(err);

        console.error('❌ Token refresh failed — user must log in again');
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
