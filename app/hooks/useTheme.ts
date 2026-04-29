import {useEffect, useState} from 'react';

const STORAGE_KEY = 'weleda-konverter:theme';

export type Theme = 'light' | 'dark';

function readInitial(): Theme {
  if (typeof document === 'undefined') {
    return 'light';
  }
  if (document.body.classList.contains('dark')) {
    return 'dark';
  }
  if (document.body.classList.contains('light')) {
    return 'light';
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // localStorage may throw in private mode / sandboxed contexts; ignore.
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage may throw in private mode / sandboxed contexts; ignore.
    }
    document.body.classList.toggle('dark', theme === 'dark');
    document.body.classList.toggle('light', theme === 'light');
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return {theme, toggle, setTheme};
}
