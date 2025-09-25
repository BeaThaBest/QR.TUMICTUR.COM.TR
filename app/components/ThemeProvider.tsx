"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (value: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }
  const stored = window.localStorage.getItem("theme") as Theme | null;
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  return media.matches ? "dark" : "light";
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Keep DOM classes/storage in sync whenever we flip the theme
  const applyTheme = useCallback((next: Theme) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("dark", next === "dark");
    root.style.colorScheme = next;
    try {
      window.localStorage.setItem("theme", next);
    } catch {
      /* ignore */
    }
  }, []);

  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
      return "dark";
    }
    return "light";
  });

  const setTheme = useCallback<ThemeContextValue["setTheme"]>((next) => {
    setThemeState(prev => {
      if (next !== prev) {
        applyTheme(next);
      }
      return next;
    });
  }, [applyTheme]);

  const toggleTheme = useCallback(() => {
    // Expose a convenient toggle so buttons do not reimplement the flip logic
    setThemeState(prev => {
      const next = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }, [applyTheme]);

  useEffect(() => {
    const resolved = resolveInitialTheme();
    applyTheme(resolved);
    setTheme(resolved);
  }, [applyTheme, setTheme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme,
    toggleTheme,
  }), [setTheme, theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("ThemeProvider missing in tree");
  return ctx;
}
