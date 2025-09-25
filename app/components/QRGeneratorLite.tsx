// components/QRGeneratorLite.tsx
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { sanitizeAscii } from "../lib/sanitize";
import { useLang } from "./LangProvider";
import PhoneInput from "./PhoneInput";
import { incrementQrCount } from "../lib/qrMetrics";
import useDebouncedEffect from "../hooks/useDebouncedEffect";

type TypeId = "url" | "text" | "email" | "phone" | "wifi";

const TYPES_EN: { id: TypeId; label: string; placeholder: string }[] = [
  { id: "url", label: "URL", placeholder: "https://example.com" },
  { id: "text", label: "Text", placeholder: "Enter your text" },
  { id: "email", label: "Email", placeholder: "name@example.com" },
  { id: "phone", label: "Phone", placeholder: "+1234567890" },
  { id: "wifi", label: "Wi‑Fi", placeholder: "Network name" },
];
const TYPES_TR: { id: TypeId; label: string; placeholder: string }[] = [
  { id: "url", label: "URL", placeholder: "https://ornek.com" },
  { id: "text", label: "Metin", placeholder: "Metninizi girin" },
  { id: "email", label: "E‑posta", placeholder: "ad@ornek.com" },
  { id: "phone", label: "Telefon", placeholder: "+905551112233" },
  { id: "wifi", label: "Wi‑Fi", placeholder: "Ağ adı" },
];

const MODE_BUTTON_CLASS = "inline-flex min-w-0 items-center justify-center px-3 py-2.5 rounded-xl text-sm font-semibold border border-border bg-card text-muted-foreground btn-tap h-11 text-center shadow-sm focus-visible:outline-none dark:bg-white/10";
const ACTIVE_BUTTON = "!bg-primary !text-white !border-primary shadow-md";
const INACTIVE_BUTTON = "hover:bg-primary/10 hover:border-primary/40 hover:text-primary";

export default function QRGeneratorLite() {
  const { lang } = useLang();
  const t = (tr:string,en:string)=> lang==='tr'?tr:en;
  const [dlSel, setDlSel] = useState<"PNG"|"JPG"|"SVG"|"WebP"|"PDF"|null>(null);
  const [active, setActive] = useState<TypeId>("url");
  const [content, setContent] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [wifiSecurity, setWifiSecurity] = useState<"WPA"|"WEP"|"nopass">("WPA");
  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#ffffff");
  const [ecc, setEcc] = useState<"L"|"M"|"Q"|"H">("M");
  const [size, setSize] = useState(256);
  const [dataUrl, setDataUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewBox = Math.min(Math.max(size, 360), 420);

  const buildPayload = () => {
    switch (active) {
      case "url":   return content.startsWith("http") ? content : `https://${content}`;
      case "email": return `mailto:${content}`;
      case "phone": return `tel:${content}`;
      case "wifi":  return `WIFI:T:${wifiSecurity};S:${content};P:${wifiPassword};;`;
      case "text":
      default:      return content;
    }
  };

  const payload = useMemo(() => buildPayload(), [active, content, wifiPassword, wifiSecurity]);

  const renderJob = useRef(0);

  const render = useCallback(async (text: string) => {
    const jobId = ++renderJob.current;
    const canvas = canvasRef.current;
    if (!canvas || !text.trim()) {
      if (renderJob.current === jobId) {
        setBusy(false);
        setDataUrl("");
      }
      return;
    }
    setBusy(true);
    try {
      await QRCode.toCanvas(canvas, text, {
        width: size,
        margin: 2,
        errorCorrectionLevel: ecc,
        color: { dark: fg, light: bg },
      });
      if (renderJob.current === jobId) {
        setDataUrl(canvas.toDataURL());
      }
    } catch (error) {
      if (renderJob.current === jobId) {
        console.error("QR render failed", error);
        setDataUrl("");
      }
    } finally {
      if (renderJob.current === jobId) {
        setBusy(false);
      }
    }
  }, [bg, ecc, fg, size]);

  useDebouncedEffect(() => {
    if (!payload.trim()) {
      renderJob.current += 1;
      setDataUrl("");
      setBusy(false);
      return;
    }
    void render(payload);
  }, [payload, render], 180);

  const download = async (fmt: "PNG"|"SVG"|"JPG"|"WebP"|"PDF") => {
    const canvas = canvasRef.current;
    if (!canvas || !dataUrl) return;
    incrementQrCount();
    let url = dataUrl;
    let name = `qrcode.${fmt.toLowerCase()}`;

    if (fmt === "SVG") {
      const svg = await QRCode.toString(payload, {
        type: "svg",
        width: size,
        margin: 2,
        errorCorrectionLevel: ecc,
        color: { dark: fg, light: bg },
      });
      url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      name = "qrcode.svg";
    } else if (fmt === "JPG") {
      const t = document.createElement("canvas");
      t.width = canvas.width; t.height = canvas.height;
      const ctx = t.getContext("2d")!;
      ctx.fillStyle = bg; ctx.fillRect(0,0,t.width,t.height);
      ctx.drawImage(canvas, 0, 0);
      url = t.toDataURL("image/jpeg", 0.92);
    } else if (fmt === "WebP") {
      url = canvas.toDataURL("image/webp", 0.92);
    } else if (fmt === "PDF") {
      // Build an SVG and embed into a PDF using dynamic imports (bundled libs)
      const svgText = await QRCode.toString(payload, {
        type: "svg",
        width: size,
        margin: 2,
        errorCorrectionLevel: ecc,
        color: { dark: fg, light: bg },
      });
      const { jsPDF } = await import('jspdf');
      await import('svg2pdf.js');
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: [size + 32, size + 32] });
      const marginPt = 16;
      // Convert SVG string to SVGElement because plugin expects a node
      const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
      const svgEl = parsed.documentElement as unknown as SVGElement;
      // @ts-ignore svg plugin method
      await doc.svg(svgEl, { x: marginPt, y: marginPt, width: size, height: size });
      doc.save("qrcode.pdf");
      return;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.title = name;
    if (isIOS) {
      // iOS Safari limits programmatic downloads — open in a new tab to allow saving.
      a.target = "_blank";
      a.rel = "noopener";
    }
    a.click();
    if (fmt === "SVG") URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-12">
      {/* LEFT */}
      <section className="space-y-5 lg:col-span-7 lg:pr-4">
        {/* Step 1 */}
        <div className="soft-card p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <span className="inline-grid place-items-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold">1</span>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">{t('İçerik türünü seç','Choose Content Type')}</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {(lang==='tr'?TYPES_TR:TYPES_EN).map(t => (
              <button
                key={t.id}
                className={`${MODE_BUTTON_CLASS} w-full ${active===t.id ? ACTIVE_BUTTON : INACTIVE_BUTTON}`}
                onClick={()=>{ setActive(t.id); setContent(""); }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <label className="block text-sm">
              <span className="text-sm text-muted-foreground">{(lang==='tr'?TYPES_TR:TYPES_EN).find(x=>x.id===active)?.label} {lang==='tr'? 'İçeriği' : 'Content'}</span>
              {active === 'phone' ? (
                <div className="mt-1">
                  <PhoneInput value={content} onChange={setContent} />
                </div>
              ) : (
                <input
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 h-11 shadow-sm focus:border-primary/40 focus:ring-0"
                  placeholder={(lang==='tr'?TYPES_TR:TYPES_EN).find(x=>x.id===active)?.placeholder}
                  value={content}
                  onChange={e=>setContent(sanitizeAscii(e.target.value))}
                />
              )}
            </label>

            {active==="wifi" && (
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block text-sm">
                <span className="text-sm text-muted-foreground">{t('Şifre','Password')}</span>
                <input className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 h-11 shadow-sm focus:border-primary/40 focus:ring-0"
                         type="password" value={wifiPassword} onChange={e=>setWifiPassword(sanitizeAscii(e.target.value))} />
              </label>
              <label className="block text-sm">
                <span className="text-sm text-muted-foreground">{t('Güvenlik','Security')}</span>
                  <select className="mt-1 w-full h-11 rounded-xl border border-border bg-card px-3 shadow-sm focus:border-primary/40 focus:ring-0"
                          value={wifiSecurity} onChange={e=>setWifiSecurity(e.target.value as any)}>
                    <option value="WPA">{t('WPA/WPA2','WPA/WPA2')}</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">{t('Yok','None')}</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Step 2 / Options */}
        <div className="soft-card p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <span className="inline-grid place-items-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold">2</span>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">{t('Renkler','Colors')}</h3>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm">
                <span className="text-sm text-muted-foreground">{t('Ön plan','Foreground')}</span>
                <div className="mt-1 flex items-center gap-2">
                  <input type="color" className="w-12 h-10 rounded border border-border" value={fg} onChange={e=>setFg(e.target.value)} />
                  <input className="flex-1 rounded-xl border border-border bg-card px-3 py-2 shadow-sm focus:border-primary/40 focus:ring-0" value={fg} onChange={e=>setFg(e.target.value)} />
                </div>
              </label>
              <label className="block text-sm">
                <span className="text-sm text-muted-foreground">{t('Arka plan','Background')}</span>
                <div className="mt-1 flex items-center gap-2">
                  <input type="color" className="w-12 h-10 rounded border border-border" value={bg} onChange={e=>setBg(e.target.value)} />
                  <input className="flex-1 rounded-xl border border-border bg-card px-3 py-2 shadow-sm focus:border-primary/40 focus:ring-0" value={bg} onChange={e=>setBg(e.target.value)} />
                </div>
              </label>
            </div>
            <div className="flex">
              <button
                type="button"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground btn-tap hover:bg-primary/10 hover:text-primary shadow-sm dark:bg-white/10"
                onClick={() => { setFg("#000000"); setBg("#ffffff"); }}
              >
                {t('Renkleri sıfırla','Reset colors')}
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 items-end">
            <label className="block text-sm">
              <span className="text-sm text-muted-foreground">{t('Hata Düzeltme Seviyesi (ECC)','ECC')}</span>
              <select className="mt-1 w-full h-11 rounded-xl border border-border bg-card px-3 focus:border-primary/40 focus:ring-0 shadow-sm"
                      value={ecc} onChange={e=>setEcc(e.target.value as any)}>
                <option value="L">{t('Düşük (L)','Low (L)')}</option>
                <option value="M">{t('Orta (M)','Medium (M)')}</option>
                <option value="Q">{t('Çeyrek (Q)','Quartile (Q)')}</option>
                <option value="H">{t('Yüksek (H)','High (H)')}</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-sm text-muted-foreground">{t('Boyut','Size')}</span>
              <select className="mt-1 w-full h-11 rounded-xl border border-border bg-card px-3 focus:border-primary/40 focus:ring-0 shadow-sm"
                      value={size} onChange={e=>setSize(parseInt(e.target.value))}>
                <option value={256}>256</option>
                <option value={512}>512</option>
                <option value={1024}>1024</option>
              </select>
            </label>
            <div>
              <button className="soft-btn w-full h-11" onClick={() => render(payload)} disabled={!content || busy}>
                {busy ? t('Oluşturuluyor…','Generating…') : t('Oluştur','Generate')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* RIGHT */}
      <aside className="space-y-6 lg:sticky lg:top-24 h-fit self-start w-full lg:col-span-5">
        <div className="soft-card p-6 shadow-lg flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="inline-grid place-items-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold">3</span>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">{t('QR Kod Önizleme','QR Code Preview')}</h3>
          </div>
          <div className="flex justify-center">
            <div
              className="bg-muted rounded-xl border-2 border-dashed border-border grid place-items-center w-full"
              style={{ maxWidth: previewBox, aspectRatio: '1 / 1' }}
            >
            {dataUrl ? (
              <div className="w-[90%] h-[90%] rounded-xl bg-card p-4 shadow-sm dark:bg-white/10">
                <img src={dataUrl} alt="QR" className="w-full h-full object-contain"/>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('QR kod üretmek için içerik girin','Enter content to generate QR code')}</p>
            )}
            </div>
          </div>

          <canvas ref={canvasRef} className="hidden" />

          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              title={t('PNG olarak indir','Download as PNG')}
              disabled={!dataUrl}
              className={`col-span-2 px-4 py-3 rounded-xl border text-center btn-tap font-medium shadow-sm ${dlSel==='PNG' ? ACTIVE_BUTTON : 'bg-card border-border text-foreground hover:bg-primary/10 hover:border-primary/30 dark:bg-white/10'} ${!dataUrl?'opacity-50 cursor-not-allowed':''}`}
              onClick={()=>{ if(!dataUrl) return; setDlSel('PNG'); download("PNG"); }}
            >{t('\"PNG\" olarak indir','Download \"PNG\"')}</button>
            <button
              title={t('JPEG olarak indir','Download as JPEG')}
              disabled={!dataUrl}
              className={`px-4 py-3 rounded-xl border text-center btn-tap font-medium shadow-sm ${dlSel==='JPG' ? ACTIVE_BUTTON : 'bg-card border-border text-foreground hover:bg-primary/10 hover:border-primary/30 dark:bg-white/10'} ${!dataUrl?'opacity-50 cursor-not-allowed':''}`}
              onClick={()=>{ if(!dataUrl) return; setDlSel('JPG'); download("JPG"); }}
            >{t('\"JPEG\" olarak indir','Download \"JPEG\"')}</button>
            <button
              title={t('SVG olarak indir','Download as SVG')}
              disabled={!dataUrl}
              className={`px-4 py-3 rounded-xl border text-center btn-tap font-medium shadow-sm ${dlSel==='SVG' ? ACTIVE_BUTTON : 'bg-card border-border text-foreground hover:bg-primary/10 hover:border-primary/30 dark:bg-white/10'} ${!dataUrl?'opacity-50 cursor-not-allowed':''}`}
              onClick={()=>{ if(!dataUrl) return; setDlSel('SVG'); download("SVG"); }}
            >{t('\"SVG\" olarak indir','Download \"SVG\"')}</button>
            <button
              title={t('WebP olarak indir','Download as WebP')}
              disabled={!dataUrl}
              className={`px-4 py-3 rounded-xl border text-center btn-tap font-medium shadow-sm ${dlSel==='WebP' ? ACTIVE_BUTTON : 'bg-card border-border text-foreground hover:bg-primary/10 hover:border-primary/30 dark:bg-white/10'} ${!dataUrl?'opacity-50 cursor-not-allowed':''}`}
              onClick={()=>{ if(!dataUrl) return; setDlSel('WebP'); download("WebP"); }}
            >{t('\"WebP\" olarak indir','Download \"WebP\"')}</button>
            <button
              title={t('PDF olarak indir','Download as PDF')}
              disabled={!dataUrl}
              className={`px-4 py-3 rounded-xl border text-center btn-tap font-medium shadow-sm ${dlSel==='PDF' ? ACTIVE_BUTTON : 'bg-card border-border text-foreground hover:bg-primary/10 hover:border-primary/30 dark:bg-white/10'} ${(!dataUrl)?'opacity-50 cursor-not-allowed':''}`}
              onClick={()=>{ if(!dataUrl) return; setDlSel('PDF'); download("PDF"); }}
            >{t('\"PDF\" olarak indir','Download \"PDF\"')}</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
