import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { googleLogin, fetchCurrentUser, fetchAuthConfig } from '../services/api.js';
import { saveName } from '../utils/session.js';

const AUTH_TOKEN_KEY = 'lt_auth_token';
const AUTH_USER_KEY = 'lt_auth_user';

const AuthContext = createContext({
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true,
  googleClientId: '',
  loginWithGoogle: async () => {},
  logout: () => {}
});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY));
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTH_USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [googleClientId, setGoogleClientId] = useState(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
  );

  // Fetch backend Google Client ID if not set in frontend env
  useEffect(() => {
    if (!googleClientId) {
      fetchAuthConfig()
        .then((data) => {
          if (data?.googleClientId) {
            setGoogleClientId(data.googleClientId);
          }
        })
        .catch(() => {
          // ignore error
        });
    }
  }, [googleClientId]);

  // Restore or validate session on mount
  useEffect(() => {
    async function restoreSession() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await fetchCurrentUser(token);
        if (data?.user) {
          setUser(data.user);
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
          if (data.user.name) saveName(data.user.name);
        }
      } catch (err) {
        console.warn('[Auth] Session validation failed, resetting:', err.message);
        setToken(null);
        setUser(null);
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, [token]);

  const loginWithGoogle = useCallback(async (credential) => {
    try {
      const data = await googleLogin(credential);
      if (data?.token && data?.user) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        if (data.user.name) {
          saveName(data.user.name);
        }
        return { success: true, user: data.user };
      }
      throw new Error('Invalid response from server.');
    } catch (err) {
      console.error('[Auth] Google login error:', err);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  }, []);

  const activeClientId = googleClientId || 'unconfigured.apps.googleusercontent.com';

  return (
    <GoogleOAuthProvider clientId={activeClientId}>
      <AuthContext.Provider
        value={{
          user,
          token,
          isAuthenticated: !!user,
          loading,
          googleClientId,
          loginWithGoogle,
          logout
        }}
      >
        {children}
      </AuthContext.Provider>
    </GoogleOAuthProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
