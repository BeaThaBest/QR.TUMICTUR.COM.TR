"use client";
import { useTheme } from "./ThemeProvider";
import { useEffect, useState } from "react";
import { useLang } from "./LangProvider";

const LABELS = {
  light: { short: "☀️", text: { en: "Light", tr: "Aydınlık" } },
  dark: { short: "🌙", text: { en: "Dark", tr: "Karanlık" } },
} as const;

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { lang } = useLang();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const label = theme === "dark" ? LABELS.dark : LABELS.light;
  // Keep server and client markup identical by rendering a static icon/text until mounted
  const shortIcon = mounted ? label.short : LABELS.light.short;
  const text = mounted ? (label.text[lang] ?? label.text.en) : (lang === "tr" ? "Aydınlık" : "Light");

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-border bg-card text-sm font-medium text-foreground shadow-sm hover:bg-primary/10 hover:border-primary/30 dark:bg-white/5 dark:text-foreground"
      aria-label={mounted ? (lang === "tr" ? `Modu ${theme === "dark" ? "aydınlık" : "karanlık"} yap` : `Switch to ${theme === "dark" ? "light" : "dark"} theme`) : (lang === "tr" ? "Tema değiştir" : "Toggle color theme")}
    >
      <span aria-hidden>{shortIcon}</span>
      <span className="hidden sm:inline">{mounted ? text : (lang === "tr" ? "Tema" : "Theme")}</span>
    </button>
  );
}
