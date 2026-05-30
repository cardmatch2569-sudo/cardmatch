'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [lang,    setLang]    = useState('th');
  const [loading, setLoading] = useState(true);
  // Bug fix: start as 'user' — only set to 'admin' for confirmed admins
  const [viewMode, setViewMode] = useState('user');

  useEffect(() => {
    const savedLang = localStorage.getItem('cg_lang') || 'th';
    setLang(savedLang);

    const token = localStorage.getItem('cg_token');
    if (!token) { setLoading(false); return; }

    api.get('/api/auth/me')
      .then(({ user }) => {
        setUser(user);
        // Set admin view mode only for admin users
        if (user?.isAdmin) setViewMode('admin');
      })
      .catch(() => localStorage.removeItem('cg_token'))
      .finally(() => setLoading(false));
  }, []);

  // Reset view mode when user changes
  useEffect(() => {
    if (!user) setViewMode('user');
    else if (user.isAdmin) setViewMode('admin');
  }, [user?._id]);

  const loginWithGoogle = async (credential) => {
    const result = await api.post('/api/auth/google', { credential });
    if (result.requiresOtp) return result;
    localStorage.setItem('cg_token', result.token);
    setUser(result.user);
    if (result.user?.isAdmin) setViewMode('admin');
    return result;
  };

  const verifyOTP = async (email, code) => {
    const { token, user } = await api.post('/api/auth/verify-otp', { email, code });
    localStorage.setItem('cg_token', token);
    setUser(user);
    if (user?.isAdmin) setViewMode('admin');
    return user;
  };

  const login = async (email, password) => {
    const { token, user } = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('cg_token', token);
    setUser(user);
    if (user?.isAdmin) setViewMode('admin');
    return user;
  };

  // Register Step 1 — validate + send OTP to email
  // Returns { requiresOtp: true, email } — caller must show OTP modal
  const register = async (username, email, password) => {
    const result = await api.post('/api/auth/register', { username, email, password });
    return result; // { requiresOtp: true, email, devCode? }
  };

  const logout = () => {
    localStorage.removeItem('cg_token');
    setUser(null);
    setViewMode('user');
  };

  const toggleLang = () => {
    const next = lang === 'th' ? 'en' : 'th';
    setLang(next);
    localStorage.setItem('cg_lang', next);
  };

  const toggleViewMode = () =>
    setViewMode(p => p === 'admin' ? 'user' : 'admin');

  const isAdminMode = user?.isAdmin && viewMode === 'admin';

  return (
    <AuthContext.Provider value={{
      user, lang, loading,
      viewMode, isAdminMode, toggleViewMode,
      login, register, loginWithGoogle, verifyOTP, logout, toggleLang,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
