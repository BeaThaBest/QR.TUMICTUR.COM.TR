"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { sanitizeAscii } from "../lib/sanitize";
import { brandLogoOptions, getBrandLogo, BrandLogoId } from "../lib/brandLogos";
import { useLang } from "./LangProvider";
import StylishQR, { StylishQRHandle } from "./StylishQR";
import FramePreview, { FrameKind } from "./FramePreview";
import PhoneInput from "./PhoneInput";
import { incrementQrCount } from "../lib/qrMetrics";


/* ---------- payload helpers (senin mantık) ---------- */
type QRType =
  | "url" | "text" | "email" | "phone" | "sms"
  | "whatsapp" | "skype" | "zoom" | "wifi"
  | "vcard" | "event"
  | "pdf" | "image" | "video" | "app" | "social"
  | "crypto" | "location" | "multi";

const ECC = ["L","M","Q","H"] as const;
const clamp = (n:number,a:number,b:number)=>Math.min(b,Math.max(a,n));
const esc = (s:string)=> (s??"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");

function buildVCard(version:"2.1"|"3.0"|"4.0", f:any){
  const lines:string[]=[
    "BEGIN:VCARD",
    `VERSION:${version}`,
    `N:${[esc(f.lastName||""), esc(f.firstName||""), "", "", ""].join(";")}`,
  ];
  const fn=[f.title, f.firstName, f.lastName].filter(Boolean).join(" ");
  if(fn) lines.push(`FN:${esc(fn)}`);
  if(f.org) lines.push(`ORG:${esc(f.org)}`);
  if(f.role) lines.push(`TITLE:${esc(f.role)}`);
  if(f.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(f.email)}`);
  if(f.website) lines.push(`URL:${esc(f.website)}`);
  if(f.mobile) lines.push(`TEL;TYPE=CELL:${esc(f.mobile)}`);
  if(f.phone)  lines.push(`TEL;TYPE=WORK,VOICE:${esc(f.phone)}`);
  if(f.fax)    lines.push(`TEL;TYPE=FAX:${esc(f.fax)}`);
  if(f.addr || f.city || f.postal || f.country){
    const adr=["","", esc(f.addr||""), esc(f.city||""), "", esc(f.postal||""), esc(f.country||"")].join(";");
    lines.push(`ADR;TYPE=WORK:${adr}`);
  }
  if(f.status) lines.push(`NOTE:${esc(f.status)}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}
function buildWifi(f:any){
  return "WIFI:"
    + `T:${(f.auth||"WPA").toUpperCase()};`
    + `S:${(f.ssid||"").replace(/([\\;,:\\"])/g,"\\$1")};`
    + (f.password ? `P:${(f.password as string).replace(/([\\;,:\\"])/g,"\\$1")};` : "")
    + (f.hidden ? "H:true;" : "")
    + ";";
}
const p2=(n:number)=>String(n).padStart(2,"0");
const toICS=(dt:string)=>!dt?"":(d=>`${d.getFullYear()}${p2(d.getMonth()+1)}${p2(d.getDate())}T${p2(d.getHours())}${p2(d.getMinutes())}00`)(new Date(dt));
function buildEvent(f:any){
  const uid=`QR-${Date.now()}@local`;
  return ["BEGIN:VCALENDAR","VERSION:2.0","BEGIN:VEVENT",
    `UID:${uid}`,
    f.summary?`SUMMARY:${esc(f.summary)}`:"",
    f.location?`LOCATION:${esc(f.location)}`:"",
    f.description?`DESCRIPTION:${esc(f.description)}`:"",
    f.start?`DTSTART:${toICS(f.start)}`:"",
    f.end?`DTEND:${toICS(f.end)}`:"",
    "END:VEVENT","END:VCALENDAR"].filter(Boolean).join("\n");
}
function buildPayload(kind:QRType, f:any):string{
  switch(kind){
    case "url": return f.url||"";
    case "text":return f.text||"";
    case "email":{ const to=encodeURIComponent(f.to||""); const s=f.subject?`?subject=${encodeURIComponent(f.subject)}`:""; const b=f.body?`${s?"&":"?"}body=${encodeURIComponent(f.body)}`:""; return `mailto:${to}${s}${b}`; }
    case "phone":return `tel:${(f.number||"").replace(/\s+/g,"")}`;
    case "sms":{ const n=(f.number||"").replace(/\s+/g,""); const t=f.text?`?body=${encodeURIComponent(f.text)}`:""; return `sms:${n}${t}`; }
    case "whatsapp":{ const n=(f.number||"").replace(/\D+/g,""); const t=f.text?`?text=${encodeURIComponent(f.text)}`:""; return `https://wa.me/${n}${t}`; }
    case "skype":return `skype:${encodeURIComponent(f.username||"")}?call`;
    case "zoom": return f.meeting?`zoommtg://zoom.us/join?action=join&confno=${encodeURIComponent(f.meeting)}`:"";
    case "wifi": return buildWifi(f);
    case "vcard":return buildVCard(f.version||"3.0", f);
    case "event":return buildEvent(f);
    case "pdf":
    case "image":
    case "video":
    case "app":
    case "social":
      return f.url||"";
    case "crypto":{
      const coin=(f.coin||"bitcoin").toLowerCase();
      const addr=(f.address||"");
      const amt=(f.amount||"");
      if(coin==="bitcoin") return `bitcoin:${addr}${amt?`?amount=${encodeURIComponent(amt)}`:""}`;
      if(coin==="ethereum") return `ethereum:${addr}${amt?`?value=${encodeURIComponent(amt)}`:""}`;
      if(coin==="litecoin") return `litecoin:${addr}${amt?`?amount=${encodeURIComponent(amt)}`:""}`;
      if(coin==="dogecoin") return `dogecoin:${addr}${amt?`?amount=${encodeURIComponent(amt)}`:""}`;
      return `${coin}:${addr}`;
    }
    case "location":{
      const lat=parseFloat(f.lat||"0");
      const lng=parseFloat(f.lng||"0");
      if(f.maps) return `https://maps.google.com/?q=${lat},${lng}`;
      return `geo:${lat},${lng}${f.label?`?q=${encodeURIComponent(f.label)}`:""}`;
    }
    case "multi":
      return ""; // handled separately in component
  }
}

/* ---------- UI Schema ---------- */
const TYPES_EN:{key:QRType;label:string}[]=[
  {key:"url",label:"URL"},{key:"text",label:"Text"},{key:"email",label:"E‑mail"},
  {key:"phone",label:"Call"},{key:"sms",label:"SMS"},{key:"whatsapp",label:"WhatsApp"},
  {key:"skype",label:"Skype"},{key:"zoom",label:"Zoom"},{key:"wifi",label:"Wi‑Fi"},
  {key:"vcard",label:"vCard"},{key:"event",label:"Event"},
  {key:"pdf",label:"PDF"},{key:"image",label:"Image"},{key:"video",label:"Video"},
  {key:"app",label:"App"},{key:"social",label:"Social"},
  {key:"crypto",label:"Crypto"},{key:"location",label:"Location"},{key:"multi",label:"Multi‑URL"},
];
const TYPES_TR:{key:QRType;label:string}[]=[
  {key:"url",label:"URL"},{key:"text",label:"Metin"},{key:"email",label:"E‑posta"},
  {key:"phone",label:"Telefon"},{key:"sms",label:"SMS"},{key:"whatsapp",label:"WhatsApp"},
  {key:"skype",label:"Skype"},{key:"zoom",label:"Zoom"},{key:"wifi",label:"Wi‑Fi"},
  {key:"vcard",label:"vCard"},{key:"event",label:"Etkinlik"},
  {key:"pdf",label:"PDF"},{key:"image",label:"Görsel"},{key:"video",label:"Video"},
  {key:"app",label:"Uygulama"},{key:"social",label:"Sosyal"},
  {key:"crypto",label:"Kripto"},{key:"location",label:"Konum"},{key:"multi",label:"Çoklu URL"},
];

type Preset = {
  name: string;
  nameTr?: string;
  fg?: string;
  bg?: string;
  gradient?: { from: string; to: string; rotation: number } | null;
  styleType?: "square"|"dots"|"rounded"|"classy"|"classy-rounded"|"extra-rounded";
  cornerSquareType?: "square"|"dot"|"extra-rounded";
  cornerDotType?: "square"|"dot"|"extra-rounded";
  frame?: FrameKind;
};

const PRIMARY_RED = "#dc2626";

const PRESETS: Preset[] = [
  { name: "Classic Red", nameTr: "Klasik Kırmızı", fg: "#dc2626", bg: "#ffffff", styleType: "rounded", cornerSquareType: "extra-rounded", cornerDotType: "dot", gradient: null, frame: "labelBottom" },
  { name: "Dark Panel", nameTr: "Koyu Panel", fg: "#ffffff", bg: "#111827", styleType: "square", cornerSquareType: "square", cornerDotType: "square", gradient: null, frame: "card" },
  { name: "Sunset", nameTr: "Günbatımı", gradient: { from: "#f59e0b", to: "#ef4444", rotation: 90 }, bg: "#ffffff", styleType: "dots", cornerSquareType: "extra-rounded", cornerDotType: "dot", frame: "sticker" },
  { name: "Mint", nameTr: "Nane", gradient: { from: "#10b981", to: "#22d3ee", rotation: 0 }, bg: "#ffffff", styleType: "classy-rounded", cornerSquareType: "extra-rounded", cornerDotType: "dot" },
  { name: "Mono", nameTr: "Tek Renk", fg: "#000000", bg: "#ffffff", styleType: "square", cornerSquareType: "square", cornerDotType: "square", frame: "none" },
  { name: "Soft Rose", nameTr: "Yumuşak Pembe", gradient: { from: "#fb7185", to: "#ef4444", rotation: 45 }, bg: "#ffffff", styleType: "rounded", cornerSquareType: "extra-rounded", cornerDotType: "dot", frame: "ribbon" },
];

const DEFAULT_LABELS: Record<"tr" | "en", string> = {
  tr: "Beni tara",
  en: "Scan me",
};

const SCHEMAS_EN: Record<QRType,{label:string;fields:{key:string;label:string;type?:"text"|"textarea"|"datetime-local"|"checkbox";placeholder?:string;options?:any[]}[]}> = {
  url:{label:"Website (URL)",fields:[{key:"url",label:"URL",placeholder:"https://…"}]},
  text:{label:"Text",fields:[{key:"text",label:"Text",type:"textarea"}]},
  email:{label:"E‑mail",fields:[{key:"to",label:"To"},{key:"subject",label:"Subject"},{key:"body",label:"Body",type:"textarea"}]},
  phone:{label:"Phone",fields:[{key:"number",label:"Number"}]},
  sms:{label:"SMS",fields:[{key:"number",label:"Number"},{key:"text",label:"Message",type:"textarea"}]},
  whatsapp:{label:"WhatsApp",fields:[{key:"number",label:"Number"},{key:"text",label:"Message",type:"textarea"}]},
  skype:{label:"Skype",fields:[{key:"username",label:"Username"}]},
  zoom:{label:"Zoom",fields:[{key:"meeting",label:"Meeting No"}]},
  wifi:{label:"Wi‑Fi",fields:[
    {key:"auth",label:"Auth",options:["WPA","WEP","nopass"] as any},
    {key:"ssid",label:"SSID"},{key:"password",label:"Password"},
    {key:"hidden",label:"Hidden network?",type:"checkbox"}]},
  vcard:{label:"vCard",fields:[
    {key:"version",label:"Version",options:["2.1","3.0","4.0"] as any},
    {key:"title",label:"Title"},{key:"firstName",label:"First name"},{key:"lastName",label:"Last name"},
    {key:"mobile",label:"Mobile"},{key:"phone",label:"Work phone"},{key:"fax",label:"Fax"},
    {key:"email",label:"E‑mail"},{key:"website",label:"Website (URL)"},
    {key:"org",label:"Company"},{key:"role",label:"Role"},
    {key:"addr",label:"Address",type:"textarea"},{key:"postal",label:"Postal"},
    {key:"city",label:"City"},{key:"country",label:"Country"},
    {key:"status",label:"Note",type:"textarea"}]},
  event:{label:"Event",fields:[
    {key:"summary",label:"Title"},{key:"location",label:"Location"},
    {key:"description",label:"Description",type:"textarea"},
    {key:"start",label:"Starts",type:"datetime-local"},
    {key:"end",label:"Ends",type:"datetime-local"}]},
  pdf:{label:"PDF",fields:[{key:"url",label:"PDF URL",placeholder:"https://…/file.pdf"}]},
  image:{label:"Image",fields:[{key:"url",label:"Image URL",placeholder:"https://…/image.jpg"}]},
  video:{label:"Video",fields:[{key:"url",label:"Video URL",placeholder:"https://…"}]},
  app:{label:"App",fields:[{key:"url",label:"App / Store URL",placeholder:"itms-apps:// or https://play.google.com/…"}]},
  social:{label:"Social",fields:[{key:"url",label:"Profile URL",placeholder:"https://instagram.com/…"}]},
  crypto:{label:"Crypto Payment",fields:[
    {key:"coin",label:"Coin",options:["bitcoin","ethereum","litecoin","dogecoin"] as any},
    {key:"address",label:"Address"},
    {key:"amount",label:"Amount (optional)"},
  ]},
  location:{label:"Location",fields:[
    {key:"lat",label:"Latitude"},{key:"lng",label:"Longitude"},{key:"label",label:"Label (optional)"},
    {key:"maps",label:"Open in Google Maps?",type:"checkbox"},
  ]},
  multi:{label:"Multi‑URL Redirect",fields:[
    {key:"ios",label:"iOS URL",placeholder:"https://…"},
    {key:"android",label:"Android URL",placeholder:"https://…"},
    {key:"desktop",label:"Desktop URL",placeholder:"https://…"},
    {key:"fallback",label:"Fallback URL",placeholder:"https://…"},
  ]},
};

const SCHEMAS_TR: Record<QRType,{label:string;fields:{key:string;label:string;type?:"text"|"textarea"|"datetime-local"|"checkbox";placeholder?:string;options?:any[]}[]}> = {
  url:{label:"Web Sitesi (URL)",fields:[{key:"url",label:"URL",placeholder:"https://…"}]},
  text:{label:"Metin",fields:[{key:"text",label:"Metin",type:"textarea"}]},
  email:{label:"E‑posta",fields:[{key:"to",label:"Kime"},{key:"subject",label:"Konu"},{key:"body",label:"Mesaj",type:"textarea"}]},
  phone:{label:"Telefon",fields:[{key:"number",label:"Numara"}]},
  sms:{label:"SMS",fields:[{key:"number",label:"Numara"},{key:"text",label:"Mesaj",type:"textarea"}]},
  whatsapp:{label:"WhatsApp",fields:[{key:"number",label:"Numara"},{key:"text",label:"Mesaj",type:"textarea"}]},
  skype:{label:"Skype",fields:[{key:"username",label:"Kullanıcı adı"}]},
  zoom:{label:"Zoom",fields:[{key:"meeting",label:"Toplantı No"}]},
  wifi:{label:"Wi‑Fi",fields:[
    {key:"auth",label:"Güvenlik",options:["WPA","WEP","nopass"] as any},
    {key:"ssid",label:"SSID"},{key:"password",label:"Şifre"},
    {key:"hidden",label:"Gizli ağ mı?",type:"checkbox"}]},
  vcard:{label:"vCard",fields:[
    {key:"version",label:"Sürüm",options:["2.1","3.0","4.0"] as any},
    {key:"title",label:"Ünvan"},{key:"firstName",label:"Ad"},{key:"lastName",label:"Soyad"},
    {key:"mobile",label:"Cep telefonu"},{key:"phone",label:"İş telefonu"},{key:"fax",label:"Faks"},
    {key:"email",label:"E‑posta"},{key:"website",label:"Web sitesi (URL)"},
    {key:"org",label:"Şirket"},{key:"role",label:"Pozisyon"},
    {key:"addr",label:"Adres",type:"textarea"},{key:"postal",label:"Posta kodu"},
    {key:"city",label:"Şehir"},{key:"country",label:"Ülke"},
    {key:"status",label:"Not",type:"textarea"}]},
  event:{label:"Etkinlik",fields:[
    {key:"summary",label:"Başlık"},{key:"location",label:"Konum"},
    {key:"description",label:"Açıklama",type:"textarea"},
    {key:"start",label:"Başlangıç",type:"datetime-local"},
    {key:"end",label:"Bitiş",type:"datetime-local"}]},
  pdf:{label:"PDF",fields:[{key:"url",label:"PDF URL",placeholder:"https://…/file.pdf"}]},
  image:{label:"Görsel",fields:[{key:"url",label:"Görsel URL",placeholder:"https://…/image.jpg"}]},
  video:{label:"Video",fields:[{key:"url",label:"Video URL",placeholder:"https://…"}]},
  app:{label:"Uygulama",fields:[{key:"url",label:"Uygulama / Mağaza URL",placeholder:"itms-apps:// veya https://play.google.com/…"}]},
  social:{label:"Sosyal",fields:[{key:"url",label:"Profil URL",placeholder:"https://instagram.com/…"}]},
  crypto:{label:"Kripto",fields:[
    {key:"coin",label:"Para birimi",options:["bitcoin","ethereum","litecoin","dogecoin"] as any},
    {key:"address",label:"Adres"},
    {key:"amount",label:"Tutar (opsiyonel)"},
  ]},
  location:{label:"Konum",fields:[
    {key:"lat",label:"Enlem"},{key:"lng",label:"Boylam"},{key:"label",label:"Etiket (opsiyonel)"},
    {key:"maps",label:"Google Haritalar'da aç?",type:"checkbox"},
  ]},
  multi:{label:"Çoklu URL",fields:[
    {key:"ios",label:"iOS URL",placeholder:"https://…"},
    {key:"android",label:"Android URL",placeholder:"https://…"},
    {key:"desktop",label:"Masaüstü URL",placeholder:"https://…"},
    {key:"fallback",label:"Yedek URL",placeholder:"https://…"},
  ]},
};

const MODE_BUTTON_CLASS = "inline-flex min-w-0 items-center justify-center px-3 py-2.5 rounded-xl text-sm font-semibold border border-border bg-card text-muted-foreground btn-tap h-11 text-center shadow-sm focus-visible:outline-none dark:bg-white/10";
const OPTION_BUTTON_CLASS = "inline-flex min-w-0 items-center justify-center px-3 py-2.5 rounded-xl text-sm font-medium border border-border bg-card text-muted-foreground btn-tap h-11 text-center shadow-sm focus-visible:outline-none dark:bg-white/10";
const ACTIVE_BUTTON = "!bg-primary !text-white !border-primary shadow-md";
const INACTIVE_BUTTON = "hover:bg-primary/10 hover:border-primary/40 hover:text-primary";
const WIDE_FIELD_KEYS = new Set([
  "url","text","body","message","description","addr","address","status","summary","location","ssid","password","android","ios","desktop","fallback","website","org","role","email","number","meeting","coin","amount","lat","lng","label","mobile","phone","fax"
]);

/* ---------- Component ---------- */
export default function QRFullMode(){
  const { lang } = useLang();
  const t = (tr:string, en:string)=> lang==='tr'?tr:en;
  // içerik
  const [kind,setKind]=useState<QRType>("vcard");
  const [form,setForm]=useState<Record<string,any>>({version:"3.0"});

  // tasarım
  const [size,setSize]=useState(360);
  const [margin,setMargin]=useState(2);
  const [fg,setFg]=useState("#111827");
  const [bg,setBg]=useState("#ffffff");
  const [ecc,setECC]=useState<typeof ECC[number]>("M");
  const [gradient,setGradient]=useState<{from:string;to:string;rotation:number}|null>(null);
  const [transparentBg,setTransparentBg]=useState(false);
  const [hideLogoDots,setHideLogoDots]=useState(true);
  const [bgImageUrl,setBgImageUrl]=useState<string|undefined>(undefined);
  const [bgImageFit,setBgImageFit]=useState<"cover"|"contain"|"fill">("cover");

  // dynamic / analytics demo (wrap payload into /a?to=...)
  const [dynamicEnabled,setDynamicEnabled]=useState(false);
  const [utmSource,setUtmSource]=useState("");
  const [utmMedium,setUtmMedium]=useState("");
  const [utmCampaign,setUtmCampaign]=useState("");

  // shape / köşeler
  const [styleType,setStyleType]=useState<"square"|"dots"|"rounded"|"classy"|"classy-rounded"|"extra-rounded">("square");
  const [cornerSquareType,setCornerSquareType]=useState<"square"|"dot"|"extra-rounded">("square");
  const [cornerDotType,setCornerDotType]=useState<"square"|"dot"|"extra-rounded">("square");

  // logo
  const [logoDataUrl,setLogoDataUrl]=useState<string|null>(null);
  const [logoScale,setLogoScale]=useState<number>(0.25);
  const [logoSource,setLogoSource]=useState<BrandLogoId|"custom"|"none">("none");
  const [suppressedAutoLogo,setSuppressedAutoLogo]=useState<BrandLogoId|null>(null);
  const [frame,setFrame]=useState<FrameKind>("none");
  const [label,setLabel]=useState<string>(()=>DEFAULT_LABELS[lang]);
  const [labelColor,setLabelColor]=useState<string>("#ffffff");
  const [labelBgColor,setLabelBgColor]=useState<string>("#000000");
  const [labelSecondaryBgColor,setLabelSecondaryBgColor]=useState<string>(PRIMARY_RED);
  const [hideDecoration,setHideDecoration]=useState<boolean>(false);
  const [dlSel,setDlSel]=useState<"png"|"svg"|"jpeg"|"webp"|"pdf"|null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const qrHandle = useRef<StylishQRHandle|null>(null);

  const TYPES = (lang==='tr'? TYPES_TR : TYPES_EN);
  const schema=(lang==='tr'? SCHEMAS_TR : SCHEMAS_EN)[kind];
  const buildMultiRedirectUrl=(f:any)=>{
    const origin = typeof window!=="undefined" ? window.location.origin : "";
    const params=new URLSearchParams();
    if(f.ios) params.set("ios", f.ios);
    if(f.android) params.set("android", f.android);
    if(f.desktop) params.set("desktop", f.desktop);
    if(f.fallback) params.set("u", f.fallback);
    return `${origin}/m?${params.toString()}`;
  };
  const rawPayload=useMemo(()=> kind==="multi" ? buildMultiRedirectUrl(form) : buildPayload(kind,form),[kind,form]);
  const canDownload = useMemo(()=> Boolean((rawPayload||"").trim()), [rawPayload]);
  const payload=useMemo(()=>{
    if(!dynamicEnabled) return rawPayload;
    const origin = typeof window!=="undefined" ? window.location.origin : "";
    const params=new URLSearchParams({ to: rawPayload });
    if(utmSource) params.set("utm_source", utmSource);
    if(utmMedium) params.set("utm_medium", utmMedium);
    if(utmCampaign) params.set("utm_campaign", utmCampaign);
    return `${origin}/a?${params.toString()}`;
  },[dynamicEnabled, rawPayload, utmSource, utmMedium, utmCampaign]);

  const autoLogoCandidate = useMemo<BrandLogoId | null>(() => {
    const buckets: string[] = [];

    if (kind === "email") {
      const toField = typeof form.to === "string" ? form.to : "";
      if (toField) buckets.push(toField);
    }

    for (const [key, value] of Object.entries(form)) {
      if (typeof value !== "string") continue;
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes("email") || lowerKey.includes("mail")) {
        buckets.push(value);
      }
    }

    const normalized = buckets.join(" ").toLowerCase();
    if (!normalized) return null;

    const idxTru = normalized.indexOf("tru");
    const idxTum = normalized.indexOf("tum");

    if (idxTru === -1 && idxTum === -1) return null;
    if (idxTum === -1) return "tru";
    if (idxTru === -1) return "tum";
    return idxTru <= idxTum ? "tru" : "tum";
  }, [kind, form]);

  const update=(k:string,v:any)=>{
    const vv = typeof v === 'string' ? sanitizeAscii(v) : v;
    setForm(p=>({...p,[k]:vv}));
  };
  const applyLogoPreset = (id: BrandLogoId, mode: "manual" | "auto" = "manual") => {
    setLogoDataUrl(getBrandLogo(id));
    setLogoSource(id);
    if (mode === "auto" || !autoLogoCandidate) {
      setSuppressedAutoLogo(null);
    } else if (mode === "manual") {
      if (autoLogoCandidate !== id) {
        setSuppressedAutoLogo(autoLogoCandidate);
      } else {
        setSuppressedAutoLogo(null);
      }
    }
  };

  const clearLogo = (autoCandidate: BrandLogoId | null) => {
    setLogoDataUrl(null);
    setLogoSource("none");
    setSuppressedAutoLogo(autoCandidate ?? null);
  };

  const pickLogo = (file?: File | null) => {
    if (!file) {
      clearLogo(autoLogoCandidate);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : null;
      setLogoDataUrl(value);
      setLogoSource(value ? "custom" : "none");
      setSuppressedAutoLogo(null);
    };
    reader.readAsDataURL(file);
  };

  const applyPreset = (p:Preset) => {
    // Do NOT change QR colors automatically; only layout/shape.
    if(p.styleType) setStyleType(p.styleType);
    if(p.cornerSquareType) setCornerSquareType(p.cornerSquareType as any);
    if(p.cornerDotType) setCornerDotType(p.cornerDotType as any);
    if(p.frame) setFrame(p.frame);
  };

  useEffect(() => {
    if (!autoLogoCandidate) {
      return;
    }
    if (suppressedAutoLogo === autoLogoCandidate) return;
    if (logoSource === "custom") return;

    if (logoSource !== autoLogoCandidate) {
      applyLogoPreset(autoLogoCandidate, "auto");
    }
  }, [autoLogoCandidate, logoSource, suppressedAutoLogo]);

  useEffect(() => {
    if (!autoLogoCandidate && suppressedAutoLogo) {
      setSuppressedAutoLogo(null);
    }
  }, [autoLogoCandidate, suppressedAutoLogo]);

  useEffect(() => {
    setLabel(prev => {
      const trimmed = prev.trim();
      const isDefault = !trimmed || trimmed === DEFAULT_LABELS.en || trimmed === DEFAULT_LABELS.tr;
      return isDefault ? DEFAULT_LABELS[lang] : prev;
    });
  }, [lang]);

  return (
    <div className="max-w-6xl mx-auto px-6">
      <div className="grid gap-6 lg:grid-cols-12">
        {/* SOL: içerik + ayarlar */}
        <section className="space-y-5 lg:col-span-7 lg:pr-4">
          {/* Step 1 */}
          <div className="soft-card p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <span className="inline-grid place-items-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold">1</span>
              <h3 className="text-lg font-semibold tracking-tight text-foreground">{t('İçeriği doldurun','Complete the content')}</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {TYPES.map(t=>(
              <button key={t.key} onClick={()=>setKind(t.key)}
                className={`${MODE_BUTTON_CLASS} w-full ${
                  kind===t.key ? ACTIVE_BUTTON : INACTIVE_BUTTON
                }`}>
                {t.label}
              </button>
            ))}
            </div>

            <div className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">{schema.label}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {schema.fields.map(f=>{
              const v=form[f.key]??"";
              const isWide = f.type==="textarea" || WIDE_FIELD_KEYS.has(f.key) || (f.placeholder && f.placeholder.length>24);
              const labelClass = `block ${isWide ? "sm:col-span-2" : ""}`;
              if(f.options){
                return (
                  <label key={f.key} className={labelClass}>
                    <span className="text-sm text-muted-foreground">{f.label}</span>
                    <select value={v} onChange={(e)=>update(f.key,e.target.value)}
                      className="mt-1 w-full rounded-xl border border-border focus:ring-0 focus:border-primary/40 px-3 h-11 bg-card shadow-sm dark:bg-white/10">
                      {(f.options as any[]).map(o=><option key={String(o)} value={o}>{String(o)}</option>)}
                    </select>
                  </label>
                );
              }
              if(f.type==="checkbox"){
                return (
                  <label key={f.key} className="flex items-center gap-2 sm:col-span-2">
                    <input type="checkbox" checked={!!v} onChange={(e)=>update(f.key,e.target.checked)} className="rounded border-border"/>
                    <span className="text-sm">{f.label}</span>
                  </label>
                );
              }
              if(f.type==="textarea"){
                return (
                  <label key={f.key} className="block sm:col-span-2">
                    <span className="text-sm text-muted-foreground">{f.label}</span>
                    <textarea value={v} onChange={(e)=>update(f.key,e.target.value)} placeholder={f.placeholder}
                      className="mt-1 w-full rounded-xl border border-border focus:ring-0 focus:border-primary/40 px-3 py-2 min-h-[7rem] bg-card shadow-sm dark:bg-white/10"/>
                  </label>
                );
              }
              // Phone-like fields
              const isPhone = /^(number|mobile|phone|fax)$/i.test(f.key) || /phone|mobile|fax/i.test(f.label||"");
              if (isPhone) {
                return (
                  <label key={f.key} className="block sm:col-span-2">
                    <span className="text-sm text-muted-foreground">{f.label}</span>
                    <div className="mt-1">
                      <PhoneInput value={v} onChange={(e)=>update(f.key,e)} lang={lang as any} />
                    </div>
                  </label>
                );
              }
              return (
                <label key={f.key} className={labelClass}>
                  <span className="text-sm text-muted-foreground">{f.label}</span>
                  <input type={f.type||"text"} value={v} onChange={(e)=>update(f.key,e.target.value)} placeholder={f.placeholder}
                    className="mt-1 w-full rounded-xl border border-border focus:ring-0 focus:border-primary/40 px-3 py-2 h-11 bg-card shadow-sm dark:bg-white/10"/>
                </label>
              );
            })}
            </div>
            </div>
          </div>

        {/* Step 2 */}
        <div className="soft-card p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-grid place-items-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold">2</span>
                <h3 className="text-lg font-semibold tracking-tight text-foreground">{t('QR tasarımını yap','Design your QR')}</h3>
              </div>
              <button
                onClick={()=>{
                  setStyleType("square");
                  setCornerSquareType("square");
                  setCornerDotType("square");
                  clearLogo(null);
                  setFrame("none");
                  setLabel("Scan me");
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground btn-tap hover:bg-primary/10 hover:border-primary/30 hover:text-primary shadow-sm dark:bg-white/10"
              >{t('Tasarımı sıfırla','Reset design')}</button>
            </div>

            <div className="grid grid-cols-1 gap-4">
            {/* Design templates */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:bg-white/10">
              <h3 className="font-medium text-foreground mb-3">{t('Tasarım Şablonları','Design Templates')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PRESETS.map(p => (
                  <button key={p.name} onClick={()=>applyPreset(p)}
                    className={`${OPTION_BUTTON_CLASS} w-full justify-start text-left h-auto py-3`}
                    >
                    {lang==='tr' ? (p.nameTr || p.name) : p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Frame */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:bg-white/10">
              <h3 className="font-medium text-foreground mb-3">{t('Çerçeve','Frame')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(["none","labelBottom","sticker","card","ribbon","speech","cornerFold"] as const).map(f=>(
                  <button key={f} onClick={()=>setFrame(f)}
                    className={`${OPTION_BUTTON_CLASS} w-full ${frame===f?ACTIVE_BUTTON:INACTIVE_BUTTON}`}>
                    {lang==='tr'
                      ? (f==="none"?"Yok":f==="labelBottom"?"Altta etiket":f==="sticker"?"Sticker":f==="card"?"Kart":f==="ribbon"?"Kurdele":f==="speech"?"Konuşma balonu":"Köşe kıvrımı")
                      : f}
                  </button>
                ))}
              </div>
              {frame!=="none" && (
                <div className="mt-3">
                  <label className="block">
                    <span className="text-sm text-muted-foreground">{t('Etiket','Label')}</span>
                  <input value={label} onChange={e=>setLabel(sanitizeAscii(e.target.value))} className="mt-1 w-full rounded-xl border border-border focus:ring-0 focus:border-primary/40 px-3 py-2 h-11 bg-card shadow-sm dark:bg-white/10"/>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                    <label className="block">
                      <span className="text-sm text-muted-foreground">{t('Etiket yazı rengi','Label text color')}</span>
                      <input type="color" value={labelColor} onChange={e=>setLabelColor(e.target.value)} className="mt-1 w-full h-10 rounded-xl"/>
                    </label>
                    <label className="block">
                      <span className="text-sm text-muted-foreground">{t('Etiket arka plan 1','Label background 1')}</span>
                      <input type="color" value={labelBgColor} onChange={e=>setLabelBgColor(e.target.value)} className="mt-1 w-full h-10 rounded-xl"/>
                    </label>
                    <label className="block">
                      <span className="text-sm text-muted-foreground">{t('Etiket arka plan 2','Label background 2')}</span>
                      <input type="color" value={labelSecondaryBgColor} onChange={e=>setLabelSecondaryBgColor(e.target.value)} className="mt-1 w-full h-10 rounded-xl"/>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Shape */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:bg-white/10">
              <h3 className="font-medium text-foreground mb-3">{t('Şekil','Shape')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                {(["square","rounded","dots","classy","classy-rounded","extra-rounded"] as const).map(s=>(
                  <button key={s} onClick={()=>setStyleType(s)}
                    className={`${OPTION_BUTTON_CLASS} w-full ${styleType===s?ACTIVE_BUTTON:INACTIVE_BUTTON}`}>
                    {lang==='tr'
                      ? (s==="square"?"Kare":s==="rounded"?"Yuvarlak":s==="dots"?"Noktalı":s==="classy"?"Şık":s==="classy-rounded"?"Şık‑yuvarlak":"Ekstra yuvarlak")
                      : s}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-muted-foreground">{t('Köşe kareleri','Corner squares')}</span>
                  <select value={cornerSquareType} onChange={e=>setCornerSquareType(e.target.value as any)} className="mt-1 w-full rounded-xl border border-border focus:ring-0 focus:border-primary/40 px-3 h-11 bg-card shadow-sm dark:bg-white/10">
                    <option value="square">{t('kare','square')}</option>
                    <option value="dot">{t('nokta','dot')}</option>
                    <option value="extra-rounded">{t('ekstra yuvarlak','extra-rounded')}</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm text-muted-foreground">{t('Köşe noktaları','Corner dots')}</span>
                  <select value={cornerDotType} onChange={e=>setCornerDotType(e.target.value as any)} className="mt-1 w-full rounded-xl border border-border focus:ring-0 focus:border-primary/40 px-3 h-11 bg-card shadow-sm dark:bg-white/10">
                    <option value="square">{t('kare','square')}</option>
                    <option value="dot">{t('nokta','dot')}</option>
                    <option value="extra-rounded">{t('ekstra yuvarlak','extra-rounded')}</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Colors */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:bg-white/10">
              <h3 className="font-medium text-foreground mb-3">{t('Renkler','Colors')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="block"><span className="text-sm text-muted-foreground">{t('Ön plan','Foreground')}</span>
                  <input type="color" value={fg} onChange={e=>setFg(e.target.value)} className="mt-1 w-full h-10 rounded-xl border border-border shadow-sm"/></label>
                <label className="block"><span className="text-sm text-muted-foreground">{t('Arka plan','Background')}</span>
                  <input type="color" value={bg} onChange={e=>setBg(e.target.value)} className="mt-1 w-full h-10 rounded-xl border border-border shadow-sm"/></label>
                <label className="block"><span className="text-sm text-muted-foreground">{t('Boyut (px)','Size (px)')}</span>
                  <input type="number" value={size} onChange={e=>setSize(parseInt(e.target.value||"0"))} className="mt-1 w-full rounded-xl border border-border focus:ring-0 focus:border-primary/40 px-3 py-2 h-11 bg-card shadow-sm dark:bg-white/10"/></label>
                <label className="block"><span className="text-sm text-muted-foreground">{t('Kenar boşluğu','Margin')}</span>
                  <input type="number" value={margin} onChange={e=>setMargin(parseInt(e.target.value||"0"))} className="mt-1 w-full rounded-xl border border-border focus:ring-0 focus:border-primary/40 px-3 py-2 h-11 bg-card shadow-sm dark:bg-white/10"/></label>
                
                <label className="block col-span-2 md:col-span-4">
                  <span className="text-sm text-muted-foreground">{t('Gradyan (opsiyonel)','Gradient (optional)')}</span>
                  <div className="grid grid-cols-5 gap-2 mt-1">
                    <input type="color" value={gradient?.from ?? "#000000"} onChange={e=>setGradient(g=>({from:e.target.value, to:g?.to??PRIMARY_RED, rotation:g?.rotation ?? 0}))} className="border border-border rounded shadow-sm"/>
                    <input type="color" value={gradient?.to ?? PRIMARY_RED} onChange={e=>setGradient(g=>({from:g?.from ?? "#000000", to:e.target.value, rotation:g?.rotation ?? 0}))} className="border border-border rounded shadow-sm"/>
                    <input type="number" value={gradient?.rotation ?? 0} onChange={e=>setGradient(g=>({from:g?.from ?? "#000000", to:g?.to ?? "#6666ff", rotation:parseInt(e.target.value||"0")}))} className="rounded-xl border border-border focus:ring-0 focus:border-primary/40 px-3 py-2 h-11 bg-card shadow-sm dark:bg-white/10" />
                    <button onClick={()=>setGradient(null)} className="px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-primary/5 btn-tap shadow-sm">{t('Temizle','Clear')}</button>
                    <select
                      onChange={e=>{
                        const v=e.target.value;
                        if(v==="none") return setGradient(null);
                        if(v==="blue") return setGradient({from:"#0ea5e9",to:"#6366f1",rotation:45});
                        if(v==="sunset") return setGradient({from:"#f59e0b",to:"#ef4444",rotation:90});
                        if(v==="mint") return setGradient({from:"#10b981",to:"#22d3ee",rotation:0});
                      }}
                      className="rounded-lg border border-border focus:ring-0 focus:border-primary/40 bg-card px-2 py-2 text-sm shadow-sm dark:bg-white/10"
                    >
                      <option value="none">{t('Ön ayar','Preset')}</option>
                      <option value="blue">{t('Mavi','Blue')}</option>
                      <option value="sunset">{t('Günbatımı','Sunset')}</option>
                      <option value="mint">{t('Nane','Mint')}</option>
                    </select>
                  </div>
                </label>
                
              </div>
            </div>

            {/* Logo */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:bg-white/10">
              <h3 className="font-medium text-foreground mb-3">{t('Dinamik QR (takip)','Dynamic QR (tracking)')}</h3>
              <label className="flex items-center gap-2 mb-3">
                <input type="checkbox" className="rounded border-border" checked={dynamicEnabled} onChange={(e)=>setDynamicEnabled(e.target.checked)} />
                <span className="text-sm">{t('Analitik sarmalayıcıyı aç','Enable analytics wrapper')}</span>
              </label>
              {dynamicEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block">
                    <span className="text-sm text-muted-foreground">{t('UTM Kaynağı','UTM Source')}</span>
                  <input value={utmSource} onChange={e=>setUtmSource(sanitizeAscii(e.target.value))} className="mt-1 w-full rounded-xl border border-border focus:ring-0 focus:border-primary/40 px-3 py-2 h-11 bg-card shadow-sm dark:bg-white/10"/>
                  </label>
                  <label className="block">
                    <span className="text-sm text-muted-foreground">{t('UTM Medium','UTM Medium')}</span>
                  <input value={utmMedium} onChange={e=>setUtmMedium(sanitizeAscii(e.target.value))} className="mt-1 w-full rounded-xl border border-border focus:ring-0 focus:border-primary/40 px-3 py-2 h-11 bg-card shadow-sm dark:bg-white/10"/>
                  </label>
                  <label className="block">
                    <span className="text-sm text-muted-foreground">{t('UTM Kampanya','UTM Campaign')}</span>
                  <input value={utmCampaign} onChange={e=>setUtmCampaign(sanitizeAscii(e.target.value))} className="mt-1 w-full rounded-xl border border-border focus:ring-0 focus:border-primary/40 px-3 py-2 h-11 bg-card shadow-sm dark:bg-white/10"/>
                  </label>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">{t('Not: Demo analitikleri yalnızca oturum belleğindedir. Üretimde bir veritabanı kullanın.','Note: Demo analytics are session‑memory only. Use a database in production.')}</p>
            </div>

            {/* Logo */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:bg-white/10">
              <h3 className="font-medium text-foreground mb-3">Logo</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid grid-cols-2 gap-2 sm:col-span-2 w-full">
                  {brandLogoOptions.map(option => {
                    const active = logoSource === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => applyLogoPreset(option.id, "manual")}
                        className={`inline-flex w-full items-center justify-center px-4 py-2 rounded-xl border text-sm font-medium btn-tap shadow-sm ${active ? ACTIVE_BUTTON : INACTIVE_BUTTON}`}
                        aria-pressed={active}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <label className="block sm:col-span-2"><span className="text-sm text-muted-foreground">Logo dosyası</span>
                  <input type="file" accept="image/*" onChange={e=>pickLogo(e.target.files?.[0])} className="mt-1 w-full rounded-xl border border-border p-2 bg-card shadow-sm dark:bg-white/10"/></label>
                <button
                  onClick={()=>clearLogo(autoLogoCandidate)}
                  className="h-11 px-5 inline-flex items-center justify-center rounded-xl border border-border bg-card text-sm font-medium btn-tap w-full sm:w-auto sm:self-end hover:bg-primary/10 hover:border-primary/30 hover:text-primary shadow-sm dark:bg-white/10"
                >
                  Kaldır
                </button>
                <label className="block"><span className="text-sm text-muted-foreground">{t('Hata Düzeltme Seviyesi (ECC)','ECC')}</span>
                  <select value={ecc} onChange={e=>setECC(e.target.value as any)} className="mt-1 w-full rounded-xl border border-border focus:ring-0 focus:border-primary/40 px-3 h-11 bg-card shadow-sm dark:bg-white/10">
                    <option value="L">{t('Düşük (L)','Low (L)')}</option>
                    <option value="M">{t('Orta (M)','Medium (M)')}</option>
                    <option value="Q">{t('Çeyrek (Q)','Quartile (Q)')}</option>
                    <option value="H">{t('Yüksek (H)','High (H)')}</option>
                  </select></label>
                <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" className="rounded border-border" checked={hideLogoDots} onChange={e=>setHideLogoDots(e.target.checked)}/><span className="text-sm whitespace-nowrap">{t('Logonun arkasındaki noktaları gizle','Hide dots behind logo')}</span></label>
                <label className="block col-span-2"><span className="text-sm text-muted-foreground">Logo size</span>
                  <input type="range" min={0.1} max={0.5} step={0.01} value={logoScale} onChange={e=>setLogoScale(parseFloat(e.target.value))} className="mt-1 w-full accent-primary"/>
                </label>
              </div>
            </div>
            </div>
          </div>
        </section>

        {/* SAĞ: önizleme + frame */}
        <aside className="lg:sticky lg:top-24 h-fit self-start w-full lg:col-span-5">
          <div className="soft-card p-6 shadow-lg flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="inline-grid place-items-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold">3</span>
              <h3 className="text-lg font-semibold tracking-tight text-foreground">{t('QR Kod Önizleme','QR Code Preview')}</h3>
            </div>

            {/* Merkezi Frame component'i ile önizleme */}
            <div className="flex justify-center">
              <div className="w-full max-w-[420px]">
                <FramePreview
                  frame={frame}
                  label={label}
                  qrRef={qrHandle as any}
                  data={payload}
                  size={size}
                  margin={margin}
                  fg={fg}
                  bg={bg}
                  ecc={ecc}
                  logoDataUrl={logoDataUrl}
                  logoScale={logoScale}
                  styleType={styleType}
                  cornerSquareType={cornerSquareType}
                  cornerDotType={cornerDotType}
                  gradient={gradient ?? undefined}
                  transparentBg={transparentBg}
                  hideLogoBackgroundDots={hideLogoDots}
                  bgImageUrl={bgImageUrl}
                  bgImageFit={bgImageFit}
                  labelColor={labelColor}
                  labelBgColor={labelBgColor}
                  labelSecondaryBgColor={labelSecondaryBgColor}
                  hideDecoration={hideDecoration}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={!canDownload}
                title={t('PNG olarak indir','Download as PNG')}
                onClick={async () => {
                  setDlSel("png");
                  incrementQrCount();
                  // Robust PNG download using raw blob (better for Safari/iOS)
                  const raw = await qrHandle.current?.getPngBlob();
                  if (raw) {
                    const blob = raw.type === 'image/png' ? raw : new Blob([raw], { type: 'image/png' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'qr.png';
                    a.click();
                    setTimeout(()=>URL.revokeObjectURL(url), 2000);
                  } else {
                    // Fallback to built-in
                    qrHandle.current?.download("png");
                  }
                }}
                className={`col-span-2 px-4 py-3 rounded-xl border text-center btn-tap font-medium shadow-sm ${!canDownload ? 'opacity-50 cursor-not-allowed' : dlSel==='png' ? ACTIVE_BUTTON : 'bg-card border-border text-foreground hover:bg-primary/10 hover:border-primary/30 dark:bg-white/10'}`}
              >
                {t('\"PNG\" olarak indir','Download \"PNG\"')}
              </button>
              <button
                disabled={!canDownload}
                title={t('JPEG olarak indir','Download as JPEG')}
                onClick={() => { setDlSel("jpeg"); incrementQrCount(); qrHandle.current?.download("jpeg"); }}
                className={`px-4 py-3 rounded-xl border text-center btn-tap font-medium shadow-sm ${!canDownload ? 'opacity-50 cursor-not-allowed' : dlSel==='jpeg' ? ACTIVE_BUTTON : 'bg-card border-border text-foreground hover:bg-primary/10 hover:border-primary/30 dark:bg-white/10'}`}
              >
                {t('\"JPEG\" olarak indir','Download \"JPEG\"')}
              </button>
              <button
                disabled={!canDownload}
                title={t('SVG olarak indir','Download as SVG')}
                onClick={() => { setDlSel("svg"); incrementQrCount(); qrHandle.current?.download("svg"); }}
                className={`px-4 py-3 rounded-xl border text-center btn-tap font-medium shadow-sm ${!canDownload ? 'opacity-50 cursor-not-allowed' : dlSel==='svg' ? ACTIVE_BUTTON : 'bg-card border-border text-foreground hover:bg-primary/10 hover:border-primary/30 dark:bg-white/10'}`}
              >
                {t('\"SVG\" olarak indir','Download \"SVG\"')}
              </button>
              <button
                disabled={!canDownload}
                title={t('WebP olarak indir','Download as WebP')}
                onClick={() => { setDlSel("webp"); incrementQrCount(); qrHandle.current?.download("webp"); }}
                className={`px-5 py-4 rounded-xl border text-center btn-tap font-medium whitespace-nowrap shadow-sm ${!canDownload ? 'opacity-50 cursor-not-allowed' : dlSel==='webp' ? ACTIVE_BUTTON : 'bg-card border-border text-foreground hover:bg-primary/10 hover:border-primary/30 dark:bg-white/10'}`}
              >
                {t('\"WebP\" olarak indir','Download \"WebP\"')}
              </button>
              <button
                title={t('PDF olarak indir','Download as PDF')}
                disabled={!canDownload || pdfBusy}
                onClick={async () => {
                  try{
                    setPdfBusy(true);
                    incrementQrCount();
                    const svgText = await qrHandle.current?.getSvgText();
                    if (!svgText) return;
                    const { jsPDF } = await import('jspdf');
                    await import('svg2pdf.js');
                    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: [size + 32, size + 32] });
                    const marginPt = 16;
                    // Convert SVG string to SVGElement because plugin expects a node
                    const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
                    const svgEl = parsed.documentElement as unknown as SVGElement;
                    // @ts-ignore - method is injected by svg2pdf plugin
                    await doc.svg(svgEl, { x: marginPt, y: marginPt, width: size, height: size });
                    doc.save("qr.pdf");
                    setDlSel("pdf");
                  } finally {
                    setPdfBusy(false);
                  }
                }}
                className={`px-5 py-4 rounded-xl border text-center btn-tap font-medium shadow-sm ${(!canDownload || pdfBusy) ? 'opacity-50 cursor-not-allowed' : dlSel==='pdf' ? ACTIVE_BUTTON : 'bg-card border-border text-foreground hover:bg-primary/10 hover:border-primary/30 dark:bg-white/10'}`}
              >
                {pdfBusy ? t('PDF hazırlanıyor…','Preparing PDF…') : t('\"PDF\" olarak indir','Download \"PDF\"')}
              </button>
            </div>

            <details className="mt-4">
              <summary className="text-sm text-foreground cursor-pointer select-none">Veri (payload) göster</summary>
              <pre className="text-xs border border-border bg-card dark:bg-white/10 rounded-lg p-3 mt-2 overflow-x-auto max-h-48 whitespace-pre-wrap">{payload}</pre>
            </details>
            <p className="text-xs text-muted-foreground mt-4">{t('İpucu: Noktalı/Yuvarlak + Ekstra yuvarlak köşeler + yüksek ECC, logolu kullanımlarda okunabilirliği artırır.','Tip: Dots/Rounded + Extra‑rounded corners + high ECC improves readability with logos.')}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
