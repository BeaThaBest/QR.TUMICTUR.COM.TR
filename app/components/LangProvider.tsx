"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Lang = "tr" | "en";
type Ctx = { lang: Lang; setLang: (l: Lang) => void };

const LangContext = createContext<Ctx | null>(null);

export function useLang(){
  const ctx = useContext(LangContext);
  if(!ctx) throw new Error("LangProvider missing");
  return ctx;
}

export default function LangProvider({ children }: { children: React.ReactNode }){
  const [lang,setLang] = useState<Lang>("tr");

  useEffect(()=>{
    const saved = typeof window!=="undefined" ? (localStorage.getItem("lang") as Lang|null) : null;
    if(saved) setLang(saved);
  },[]);

  useEffect(()=>{
    if(typeof window!=="undefined"){ localStorage.setItem("lang", lang); document.documentElement.lang = lang; }
  },[lang]);

  const value = useMemo(()=>({lang,setLang}),[lang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

