'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import axiosInstance from '@/utils/axiosInstance';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // ✅ 1. Centralized Auth Check
  const checkAuth = async () => {
    try {
      const res = await axiosInstance.get('/auth/me'); // ✅ use relative path since baseURL already defined
      setUser(res.data);
      setAuthenticated(true);
      console.log(res.data);
      return res.data;
    } catch (err) {
      setUser(null);
      setAuthenticated(false);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // ✅ 2. Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // ✅ 3. Login
 const login = async (email, password) => {
  try {
    const res=await axiosInstance.post('/auth/login', { email, password });
    console.log("login called");
    console.log("user",res)

    // Wait for cookies to be stored in the browser
    // await new Promise(res => setTimeout(res, 300));

    // const currentUser = await checkAuth();
    return { success: true, user: res };
  } catch (err) {
    console.error('Login failed:', err);
    return { success: false, message: err.response?.data?.message || 'Login failed' };
  }
};


  // ✅ 4. Signup
  const signup = async (username, email, password, role) => {
    try {
      await axiosInstance.post('/auth/register', { username, email, password, role });
      const currentUser = await checkAuth();
      return { success: true, user: currentUser };
    } catch (err) {
      console.error('Signup failed:', err);
      return { success: false, message: err.response?.data?.message || 'Signup failed' };
    }
  };

  // ✅ 5. Logout
  const logout = async () => {
    try {
      await axiosInstance.post('/auth/logout');
      setUser(null);
      setAuthenticated(false);
    } catch (err) {
      console.error('Logout failed:', err);
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
