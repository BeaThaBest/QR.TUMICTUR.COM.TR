"use client";
import { useLang } from "./LangProvider";

export default function LangSwitch(){
  const { lang, setLang } = useLang();
  const toggle = () => setLang(lang === "tr" ? "en" : "tr");
  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-medium btn-tap shadow-sm dark:bg-white/10"
      aria-label="Change language"
    >
      <span className={`px-1.5 py-0.5 rounded ${lang==='tr' ? 'bg-primary/10 text-primary' : 'bg-transparent'}`}>TR</span>
      <span>•</span>
      <span className={`px-1.5 py-0.5 rounded ${lang==='en' ? 'bg-primary/10 text-primary' : 'bg-transparent'}`}>EN</span>
    </button>
  );
}
