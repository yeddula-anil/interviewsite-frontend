'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import axiosInstance from '@/utils/axiosInstance';
import { useRouter } from 'next/navigation';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // ✅ Fetch current user if token exists
  const checkAuth = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

    if (!token) {
      setUser(null);
      setAuthenticated(false);
      setLoading(false);
      return null;
    }

    try {
      const res = await axiosInstance.get('/auth/me');
      setUser(res.data);
      setAuthenticated(true);
      return res.data;
    } catch (err) {
      console.warn('❌ Auth check failed:', err.response?.status);
      localStorage.removeItem('accessToken');
      setUser(null);
      setAuthenticated(false);
      router.replace('/auth/signin');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // ✅ Check authentication on page load or refresh
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      // small delay to ensure token is attached to axios
      setTimeout(() => checkAuth(), 150);
    } else {
      setLoading(false);
    }
  }, []);

  // ✅ Login function
  const login = async (email, password) => {
    try {
      const res = await axiosInstance.post('/auth/login', { email, password });

      if (res.data.accessToken) {
        localStorage.setItem('accessToken', res.data.accessToken);
      }

      
        // Otherwise fetch it manually
      const data=await checkAuth();
      console.log(data.user)
      

      return { success: true, user: data};
    } catch (err) {
      console.error('❌ Login failed:', err.response?.data || err.message);
      return {
        success: false,
        message: err.response?.data?.message || 'Login failed',
      };
    }
  };
  const signup = async (username, email, password,role) => {
  try {
    const res = await axiosInstance.post('/auth/register', {
      username,
      email,
      password,
      role
    });

    // If backend returns a token on signup
    if (res.data.accessToken) {
      localStorage.setItem('accessToken', res.data.accessToken);
    }

    // Fetch and set the authenticated user
    const data = await checkAuth();

    return { success: true, user: data };
  } catch (err) {
    console.error('❌ Signup failed:', err.response?.data || err.message);
    return {
      success: false,
      message: err.response?.data?.message || 'Signup failed',
    };
  }
};

  // ✅ Logout function
  const logout = async () => {
    try {
      await axiosInstance.post('/auth/logout');
    } catch (err) {
      console.error('❌ Logout failed:', err.response?.data || err.message);
    } finally {
      localStorage.removeItem('accessToken');
      setUser(null);
      setAuthenticated(false);
      router.replace('/auth/signin');
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

// ✅ Custom hook for easy usage
export const useAuth = () => useContext(AuthContext);
