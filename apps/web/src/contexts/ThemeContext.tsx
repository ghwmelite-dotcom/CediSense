import { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'dark' | 'light' | 'system';
type ResolvedTheme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  resolved: 'dark',
  setTheme: () => {},
  toggle: () => {},
});

const STORAGE_KEY = 'cedisense-theme';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function resolve(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    // No saved preference → follow the OS, matching the index.html boot script.
    // (Defaulting to 'dark' here desynced React from the painted page and left
    // the landing with dark cards on a light canvas.)
    return 'system';
  });

  const [resolved, setResolved] = useState<ResolvedTheme>(() => {
    // Trust the data-theme the boot script already painted so React never
    // disagrees with the visible page (no light-page / dark-card first frame).
    if (typeof document !== 'undefined') {
      const attr = document.documentElement.getAttribute('data-theme');
      if (attr === 'light' || attr === 'dark') return attr;
    }
    return resolve(theme);
  });

  // Apply to DOM
  useEffect(() => {
    const r = resolve(theme);
    setResolved(r);
    document.documentElement.setAttribute('data-theme', r);
    // Also set meta theme-color for mobile browser chrome
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', r === 'light' ? '#F7F5F0' : '#0d0d1a');
    }
  }, [theme]);

  // Listen for system preference changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => {
      const r = resolve('system');
      setResolved(r);
      document.documentElement.setAttribute('data-theme', r);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  }, []);

  const toggle = useCallback(() => {
    setTheme(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
