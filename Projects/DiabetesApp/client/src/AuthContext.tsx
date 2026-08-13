import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setAuthToken } from './api';
import type { RegisterResult, User } from './authTypes';
import { AUTH_TOKEN_KEY } from './authStorage';
import { useTheme } from './ThemeContext';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<RegisterResult>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<RegisterResult>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { syncThemeFromAccount } = useTheme();

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    async function restoreSession() {
      const params = new URLSearchParams(window.location.search);
      if (params.get('verify') || params.get('reset')) {
        setLoading(false);
        return;
      }

      const saved = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!saved) {
        setLoading(false);
        return;
      }
      setAuthToken(saved);
      try {
        const { user: me } = await api.me();
        setUser(me);
        await syncThemeFromAccount();
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, [logout, syncThemeFromAccount]);

  async function login(email: string, password: string) {
    const { user: loggedIn, token } = await api.login(email, password);
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    setAuthToken(token);
    setUser(loggedIn);
    await syncThemeFromAccount();
  }

  async function register(email: string, password: string, displayName: string) {
    return api.register(email, password, displayName);
  }

  const verifyEmail = useCallback(async (token: string) => {
    await api.verifyEmail(token);
  }, []);

  async function resendVerification(email: string) {
    return api.resendVerification(email);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, verifyEmail, resendVerification, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
