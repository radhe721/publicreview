import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

const ThemeContext = createContext({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => null,
  cycleTheme: () => null,
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem('ideapulse_theme') || 'system';
    } catch {
      return 'system';
    }
  });

  const getSystemTheme = () => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const [resolvedTheme, setResolvedTheme] = useState(() => {
    const initialTheme = typeof window !== 'undefined' ? (localStorage.getItem('ideapulse_theme') || 'system') : 'system';
    return initialTheme === 'system' ? getSystemTheme() : initialTheme;
  });

  const isInitialMount = useRef(true);

  const disableTransitions = () => {
    const css = document.createElement('style');
    css.appendChild(
      document.createTextNode(
        `*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}`
      )
    );
    document.head.appendChild(css);

    return () => {
      // Force repaint
      (() => window.getComputedStyle(document.body))();

      // Enable transitions back in next frame
      requestAnimationFrame(() => {
        if (css.parentNode) {
          css.parentNode.removeChild(css);
        }
      });
    };
  };

  const applyTheme = useCallback((targetMode) => {
    const root = document.documentElement;
    const active = targetMode === 'system' ? getSystemTheme() : targetMode;

    const restoreTransitions = disableTransitions();

    setResolvedTheme(active);

    root.classList.remove('light', 'dark');
    root.classList.add(active);
    root.style.colorScheme = active;

    const metaThemeColor = document.getElementById('meta-theme-color');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', active === 'dark' ? '#121417' : '#FFFFFF');
    }

    restoreTransitions();
  }, []);

  // Set theme explicitly
  const setTheme = useCallback((newTheme) => {
    try {
      localStorage.setItem('ideapulse_theme', newTheme);
    } catch {
      // Ignore localStorage errors
    }
    setThemeState(newTheme);
    applyTheme(newTheme);
  }, [applyTheme]);

  // Direct toggle between light and dark (fast, instant 1-click toggle)
  const cycleTheme = useCallback(() => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  useEffect(() => {
    applyTheme(theme, false);
    isInitialMount.current = false;

    // Listen to OS system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (theme === 'system') {
        applyTheme('system', true);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemChange);
      return () => mediaQuery.removeEventListener('change', handleSystemChange);
    } else {
      mediaQuery.addListener(handleSystemChange);
      return () => mediaQuery.removeListener(handleSystemChange);
    }
  }, [theme, applyTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
