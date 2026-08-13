import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, setAuthToken } from './api';
import { AUTH_TOKEN_KEY } from './authStorage';

export type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  syncThemeFromAccount: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    theme === 'dark' ? '#042f2e' : '#0d9488',
  );
}

function readStoredAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const userToggledRef = useRef(!!localStorage.getItem('theme'));

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const syncThemeFromAccount = useCallback(async () => {
    const token = readStoredAuthToken();
    if (userToggledRef.current || !token) return;
    setAuthToken(token);
    try {
      const { value } = await api.getSetting('theme');
      if (value === 'dark' || value === 'light') {
        setTheme(value);
      }
    } catch {
      // Keep local theme when offline or logged out
    }
  }, []);

  const toggleTheme = useCallback(() => {
    userToggledRef.current = true;
    setTheme((current) => {
      const next = current === 'light' ? 'dark' : 'light';
      const token = readStoredAuthToken();
      if (token) {
        setAuthToken(token);
        api.setSetting('theme', next).catch(() => {});
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, syncThemeFromAccount }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
