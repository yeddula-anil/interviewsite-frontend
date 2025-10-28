import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`,
  withCredentials: true, // send cookies
});

// Avoid multiple refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error = null) => {
  failedQueue.forEach(({ resolve, reject, originalRequest }) => {
    if (error) {
      reject(error);
    } else {
      resolve(axiosInstance(originalRequest));
    }
  });
  failedQueue = [];
};

// Plain axios instance for refresh (no interceptor)
const refreshInstance = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`,
  withCredentials: true,
});

axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Avoid retrying refresh request itself
      if (originalRequest.url.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (isRefreshing) {
        // Queue the request and wait until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, originalRequest });
        });
      }

      isRefreshing = true;

      try {
        // Call refresh token endpoint
        await refreshInstance.post('/auth/refresh');

        isRefreshing = false;
        // Retry all queued requests
        processQueue();

        // Retry original request
        return axiosInstance(originalRequest);
      } catch (err) {
        isRefreshing = false;
        
        processQueue(err); // Reject all queued requests
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
