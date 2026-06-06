'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

// Token helpers — sessionStorage is per-tab (fixes multi-tab same-browser testing),
// localStorage is fallback for persistent login (new tab or first load).
const getToken    = () => sessionStorage.getItem('cg_token') || localStorage.getItem('cg_token');
const setToken    = (t) => { sessionStorage.setItem('cg_token', t); localStorage.setItem('cg_token', t); };
const removeToken = () => { sessionStorage.removeItem('cg_token'); localStorage.removeItem('cg_token'); };

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [lang,    setLang]    = useState(() => {
    if (typeof window === 'undefined') return 'th';
    return localStorage.getItem('cg_lang') || 'th';
  });
  const [loading, setLoading] = useState(true);
  // Bug fix: start as 'user' — only set to 'admin' for confirmed admins
  const [viewMode, setViewMode] = useState('user');

  useEffect(() => {

    const token = getToken();
    if (!token) { setLoading(false); return; }

    // If token came from localStorage only (new tab), mirror it to sessionStorage
    if (!sessionStorage.getItem('cg_token')) sessionStorage.setItem('cg_token', token);

    api.get('/api/auth/me')
      .then(({ user }) => {
        setUser(user);
        // Set admin view mode only for admin users
        if (user?.isAdmin) setViewMode('admin');
      })
      .catch(() => removeToken())
      .finally(() => setLoading(false));
  }, []);

  // Reset view mode when user changes
  useEffect(() => {
    if (!user) setViewMode('user');
    else if (user.isAdmin) setViewMode('admin');
  }, [user?._id, user?.isAdmin]);

  const loginWithGoogle = async (credential) => {
    const result = await api.post('/api/auth/google', { credential });
    if (result.requiresOtp) return result;
    setToken(result.token);
    setUser(result.user);
    if (result.user?.isAdmin) setViewMode('admin');
    return result;
  };

  const verifyOTP = async (email, code) => {
    const { token, user } = await api.post('/api/auth/verify-otp', { email, code });
    setToken(token);
    setUser(user);
    if (user?.isAdmin) setViewMode('admin');
    return user;
  };

  const login = async (email, password) => {
    const { token, user } = await api.post('/api/auth/login', { email, password });
    setToken(token);
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
    removeToken();
    setUser(null);
    setViewMode('user');
  };

  const toggleLang = () => {
    const next = lang === 'th' ? 'en' : 'th';
    setLang(next);
    localStorage.setItem('cg_lang', next);
    document.documentElement.lang = next;
  };

  const toggleViewMode = () => {
    if (!user?.isAdmin) return;
    setViewMode(p => p === 'admin' ? 'user' : 'admin');
  };

  const isAdminMode = user?.isAdmin && viewMode === 'admin';

  return (
    <AuthContext.Provider value={{
      user, setUser, lang, loading,
      viewMode, isAdminMode, toggleViewMode,
      login, register, loginWithGoogle, verifyOTP, logout, toggleLang,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
