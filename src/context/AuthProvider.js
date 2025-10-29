'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import axiosInstance from '@/utils/axiosInstance';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // ✅ 1. Check if the user is authenticated
  const checkAuth = async () => {
    try {
      const res = await axiosInstance.get('/auth/me'); // backend endpoint
      setUser(res.data);
      setAuthenticated(true);
      console.log("✅ Auth check success:", res.data);
      return res.data;
    } catch (err) {
      console.warn("❌ Auth check failed:", err.response?.status);
      setUser(null);
      setAuthenticated(false);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // ✅ 2. Run auth check on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // ✅ 3. Login handler
  const login = async (email, password) => {
    try {
      const res = await axiosInstance.post('/auth/login', { email, password });
      console.log("✅ Login successful:", res.data);

      // Wait for tokens to be stored
      await new Promise(res => setTimeout(res, 200));

      // Verify user after login
      const currentUser = await checkAuth();
      return { success: true, user: currentUser };
    } catch (err) {
      console.error("❌ Login failed:", err.response?.data || err.message);
      return { success: false, message: err.response?.data?.message || 'Login failed' };
    }
  };

  // ✅ 4. Signup handler
  const signup = async (username, email, password, role) => {
    try {
      const res = await axiosInstance.post('/auth/register', { username, email, password, role });
      console.log("✅ Signup successful:", res.data);
      const currentUser = await checkAuth();
      return { success: true, user: currentUser };
    } catch (err) {
      console.error("❌ Signup failed:", err.response?.data || err.message);
      return { success: false, message: err.response?.data?.message || 'Signup failed' };
    }
  };

  // ✅ 5. Logout handler
  const logout = async () => {
    try {
      await axiosInstance.post('/auth/logout');
      setUser(null);
      setAuthenticated(false);
      console.log("✅ Logged out successfully");
    } catch (err) {
      console.error("❌ Logout failed:", err.response?.data || err.message);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authenticated,
        loading,
        login,
        signup,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
