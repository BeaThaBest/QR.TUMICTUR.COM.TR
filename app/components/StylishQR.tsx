"use client";

import React, { useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import QRCodeStyling from "qr-code-styling";
import useDebouncedValue from "../hooks/useDebouncedValue";

type Extension = "png" | "svg" | "jpeg" | "webp";
type DotsType = "square" | "dots" | "rounded" | "classy" | "classy-rounded" | "extra-rounded";
type CornerType = "square" | "dot" | "extra-rounded";

export type StylishQROptions = {
  data: string;
  size: number;
  margin: number;
  fg: string;
  bg: string;
  ecc: "L" | "M" | "Q" | "H";
  logoDataUrl?: string | null;
  logoScale?: number;
  styleType: DotsType;
  cornerSquareType: CornerType;
  cornerDotType: CornerType;
  gradient?: { from: string; to: string; rotation?: number } | null;
  transparentBg?: boolean;
  hideLogoBackgroundDots?: boolean;
  chrome?: "card" | "bare";
  circular?: boolean;
  bgImageUrl?: string | null;
  bgImageFit?: "cover" | "contain" | "fill";
};

export type StylishQRHandle = {
  download: (ext: Extension) => void;
  getSvgText: () => Promise<string | null>;
  getPngBlob: () => Promise<Blob | null>;
};

const StylishQR = forwardRef<StylishQRHandle, StylishQROptions>(function StylishQR(props, ref) {
  const {
    data, size, margin, fg, bg, ecc, logoDataUrl, logoScale = 0.25,
    styleType, cornerSquareType, cornerDotType,
    gradient, transparentBg, hideLogoBackgroundDots,
    chrome = "card", circular = false,
    bgImageUrl = null, bgImageFit = "cover",
  } = props;

  const mountRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<QRCodeStyling | null>(null);

  const options = useMemo(() => {
    const logoScaleRatio = Math.max(0.1, Math.min(0.5, logoScale));
    const color = gradient ? undefined : fg;
    const gradientOptions = gradient
      ? {
          type: "linear" as const,
          rotation: ((gradient.rotation ?? 0) * Math.PI) / 180,
          colorStops: [
            { offset: 0, color: gradient.from },
            { offset: 1, color: gradient.to },
          ],
        }
      : undefined;

    const effectiveDotsType: DotsType = circular
      ? (styleType === "square" || styleType === "classy" ? "rounded" : styleType)
      : styleType;

    return {
      width: size,
      height: size,
      margin,
      type: "svg" as const,
      data: data || " ",
      qrOptions: { errorCorrectionLevel: ecc },
      backgroundOptions: transparentBg ? {} : { color: bg },
      image: logoDataUrl || undefined,
      imageOptions: {
        imageSize: logoScaleRatio,
        scale: logoScaleRatio,
        crossOrigin: "anonymous",
        margin: Math.max(0, Math.round(size * 0.02)),
        hideBackgroundDots: !!hideLogoBackgroundDots,
      },
      dotsOptions: { type: effectiveDotsType, color, gradient: gradientOptions },
      cornersSquareOptions: { type: cornerSquareType, color },
      cornersDotOptions: { type: cornerDotType, color },
    };
  }, [
    data, size, margin, fg, bg, ecc, logoDataUrl, logoScale,
    styleType, cornerSquareType, cornerDotType,
    gradient, transparentBg, hideLogoBackgroundDots, circular,
  ]);

  const debouncedOptions = useDebouncedValue(options, 180);

  useEffect(() => {
    if (!instanceRef.current) {
      instanceRef.current = new QRCodeStyling(debouncedOptions as any);
      if (mountRef.current) instanceRef.current.append(mountRef.current);
    } else {
      instanceRef.current.update(debouncedOptions as any);
    }
  }, [debouncedOptions]);

  useEffect(() => {
    if (mountRef.current && instanceRef.current) {
      mountRef.current.innerHTML = "";
      instanceRef.current.append(mountRef.current);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    download: (ext: Extension) => instanceRef.current?.download({ extension: ext, name: "qr" }),
    getSvgText: async () => {
      if (!instanceRef.current) return null;
      const blob = (await instanceRef.current.getRawData("svg")) as Blob | null;
      if (!blob) return null;
      return await blob.text();
    },
    getPngBlob: async () => {
      if (!instanceRef.current) return null;
      const blob = (await instanceRef.current.getRawData("png")) as Blob | null;
      return blob ?? null;
    }
  }));

  const wrapperClass = chrome === "card"
    ? "rounded-2xl border p-4 flex items-center justify-center shadow-sm"
    : "flex items-center justify-center";

  const wrapperStyle: React.CSSProperties = chrome === "card"
    ? { width: size + 32, height: size + 32, overflow: circular ? "hidden" : undefined, borderRadius: circular ? 9999 : undefined,
        backgroundColor: transparentBg || bgImageUrl ? "transparent" : "white",
        backgroundImage: bgImageUrl ? `url(${bgImageUrl})` : undefined,
        backgroundSize: bgImageFit,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : { width: size, height: size, overflow: circular ? "hidden" : undefined, borderRadius: circular ? 9999 : undefined,
        backgroundImage: bgImageUrl ? `url(${bgImageUrl})` : undefined,
        backgroundSize: bgImageFit,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      };

  return (
    <div className="space-y-3 relative z-10">
      <div ref={mountRef} className={wrapperClass} style={wrapperStyle} />
    </div>
  );
});

export default StylishQR;
