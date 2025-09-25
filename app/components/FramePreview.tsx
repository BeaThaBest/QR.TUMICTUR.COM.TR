"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import StylishQR, { StylishQROptions, StylishQRHandle } from "./StylishQR";
import { useLang } from "./LangProvider";

export type FrameKind = "none" | "labelBottom" | "sticker" | "card" | "phone" | "ribbon" | "speech" | "cornerFold";

type Props = {
  frame: FrameKind;
  label?: string;
  qrRef?: React.MutableRefObject<StylishQRHandle | null>;
  labelColor?: string;
  labelBgColor?: string;
  labelSecondaryBgColor?: string;
  hideDecoration?: boolean;
} & StylishQROptions;

export default function FramePreview({ frame, label, qrRef, labelColor = "#ffffff", labelBgColor = "#000000", labelSecondaryBgColor = "#dc2626", hideDecoration = false, ...qr }: Props) {
  const { lang } = useLang();
  const localRef = useRef<StylishQRHandle | null>(null);
  // Keep the visual preview responsive without touching the underlying QR data used for downloads.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const gradientDiagonal = `linear-gradient(135deg, ${labelBgColor}, ${labelSecondaryBgColor})`;
  const gradientHorizontal = `linear-gradient(90deg, ${labelBgColor}, ${labelSecondaryBgColor})`;
  const trimmedLabel = (label ?? "").trim();
  const hasLabel = trimmedLabel.length > 0;
  const defaultLabel = lang === "tr" ? "Beni tara" : "Scan me";
  const labelText = hasLabel ? trimmedLabel : defaultLabel;
  const cardHeading = hasLabel ? trimmedLabel : (lang === "tr" ? "Şirketiniz" : "YourCompany");
  const phonePrompt = hasLabel ? trimmedLabel : (lang === "tr" ? "Kamerayı Aç → Tara" : "Open Camera → Scan");

  // Bridge the ref provided by parents to the underlying StylishQR instance
  useEffect(() => {
    if (!qrRef) return;
    qrRef.current = localRef.current;
    return () => { if (qrRef) qrRef.current = null; };
  }, [qrRef]);

  // Compute a scale factor so every frame variant fits its container
  const recalcScale = useCallback(() => {
    const container = containerRef.current;
    const frameEl = frameRef.current;
    if (!container || !frameEl) return;

    const naturalWidth = frameEl.offsetWidth;
    const naturalHeight = frameEl.offsetHeight;
    if (!naturalWidth || !naturalHeight) return;

    const containerWidth = container.offsetWidth;
    const nextScale = containerWidth ? Math.min(1, containerWidth / naturalWidth) : 1;

    setFrameSize(prev => (prev.width !== naturalWidth || prev.height !== naturalHeight)
      ? { width: naturalWidth, height: naturalHeight }
      : prev
    );

    setScale(prev => Math.abs(prev - nextScale) > 0.01 ? nextScale : prev);
  }, []);

  useEffect(() => {
    recalcScale();
  }, [
    recalcScale,
    frame,
    label,
    labelBgColor,
    labelSecondaryBgColor,
    labelColor,
    lang,
    hideDecoration,
    qr.size,
    qr.margin,
    qr.logoScale,
    qr.styleType,
    qr.cornerSquareType,
    qr.cornerDotType,
    qr.gradient,
    qr.transparentBg,
    qr.bgImageUrl,
    qr.bgImageFit,
    qr.hideLogoBackgroundDots,
    qr.fg,
    qr.bg,
    qr.logoDataUrl,
    qr.ecc,
    qr.data,
  ]);

  // Watch container size and recompute scale when the layout changes
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => recalcScale());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [recalcScale]);

  // Also watch the frame wrapper itself so gradient/label changes keep scaling correct
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    if (!frameRef.current) return;
    const observer = new ResizeObserver(() => recalcScale());
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, [recalcScale]);

  const content = <div className="relative z-10"><StylishQR ref={localRef} {...qr} circular={frame === "sticker"} chrome="bare" /></div>;

  let frameNode: React.ReactNode;

  if (frame === "sticker") {
    frameNode = (
      <div className="relative mx-auto w-fit">
        {!hideDecoration && <div className="shader"></div>}
        <div className="relative rounded-full p-4 border-4" style={{ borderColor: labelBgColor, background: gradientDiagonal }}>
          {content}
        </div>
        {hasLabel && (
          <div className="mt-2 text-center">
            <span className="inline-block text-xs font-medium rounded-lg py-1 px-3 shadow" style={{ background: gradientHorizontal, color: labelColor }}>{trimmedLabel}</span>
          </div>
        )}
      </div>
    );
  } else if (frame === "labelBottom") {
    frameNode = (
      <div className="rounded-2xl border border-border bg-card p-4 w-fit mx-auto shadow dark:bg-white/10">
        {content}
        <div className="mt-2">
          <span className="block text-center text-xs font-medium rounded-lg py-1 px-3 shadow" style={{ background: gradientHorizontal, color: labelColor }}>{labelText}</span>
        </div>
      </div>
    );
  } else if (frame === "card") {
    frameNode = (
      <div className="rounded-3xl border border-border shadow-xl overflow-hidden w-fit mx-auto bg-card dark:bg-white/10">
        <div className="px-6 py-4 text-sm font-semibold text-center" style={{ background: gradientHorizontal, color: labelColor }}>
          {cardHeading}
        </div>
        <div className="p-6 pt-5">
          <div className="rounded-2xl p-4 shadow-inner" style={{ background: gradientDiagonal }}>
            <div className="rounded-xl bg-card p-4 shadow-sm dark:bg-white/10">
              {content}
            </div>
          </div>
        </div>
      </div>
    );
  } else if (frame === "phone") {
    frameNode = (
      <div className="mx-auto w-fit">
        <div className="relative rounded-[36px] border border-border bg-card shadow-2xl p-5 w-[340px] dark:bg-white/10">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-1.5 rounded-full bg-border dark:bg-white/40" />
          <div className="mt-6 rounded-2xl border border-border bg-card p-4 dark:bg-white/10">
            {content}
          </div>
          <div className="mt-3 text-center text-sm text-muted-foreground">{phonePrompt}</div>
        </div>
      </div>
    );
  } else if (frame === "ribbon") {
    frameNode = (
      <div className="relative w-fit mx-auto">
        {hasLabel && (
          <div className="absolute -top-3 left-4 text-xs px-3 py-1 rounded-md shadow z-20" style={{ background: gradientHorizontal, color: labelColor }}>{trimmedLabel}</div>
        )}
        <div className="relative z-10">{content}</div>
      </div>
    );
  } else if (frame === "speech") {
    frameNode = (
      <div className="relative w-fit mx-auto">
        <div className="relative z-10">{content}</div>
        {hasLabel && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-sm px-3 py-1 rounded-full shadow z-20" style={{ background: gradientHorizontal, color: labelColor }}>
            {trimmedLabel}
          </div>
        )}
      </div>
    );
  } else if (frame === "cornerFold") {
    frameNode = (
      <div className="relative w-fit mx-auto rounded-2xl shadow-xl border border-border bg-card p-2 dark:bg-white/10">
        {!hideDecoration && <div className="absolute -right-1 -top-1 w-8 h-8 rounded-bl-2xl rounded-tr-md z-20" style={{ background: gradientDiagonal }}></div>}
        <div className="relative z-10">{content}</div>
        {hasLabel && (
          <div className="mt-2 text-center">
            <span className="inline-block text-xs font-medium rounded-lg py-1 px-3 shadow" style={{ background: gradientHorizontal, color: labelColor }}>{trimmedLabel}</span>
          </div>
        )}
      </div>
    );
  } else {
    frameNode = <div className="w-fit mx-auto">{content}</div>;
  }

  const scaledWidth = frameSize.width ? frameSize.width * scale : undefined;
  const scaledHeight = frameSize.height ? frameSize.height * scale : undefined;

  return (
    <div ref={containerRef} className="w-full">
      <div
        className="relative"
        style={{
          width: scaledWidth ?? "100%",
          height: scaledHeight,
          margin: "0 auto",
        }}
      >
        <div
          ref={frameRef}
          style={{
            position: "relative",
            left: "50%",
            transform: `translateX(-50%) scale(${scale})`,
            transformOrigin: "top center",
            width: "max-content",
          }}
        >
          {frameNode}
        </div>
      </div>
    </div>
  );
}
