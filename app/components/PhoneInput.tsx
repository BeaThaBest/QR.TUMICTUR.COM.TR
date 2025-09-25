"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "./LangProvider";
import { getCountries, getCountryCallingCode, AsYouType, isValidPhoneNumber, getExampleNumber } from "libphonenumber-js/max";
// Lightweight examples dataset for placeholders
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – JSON import for examples
import examples from "libphonenumber-js/examples.mobile.json";

type Country = { code: string; dial: string; name: string };

const BASE_COUNTRIES: Country[] = getCountries().map(code => ({
  code,
  dial: `+${getCountryCallingCode(code)}`,
  name: code,
}));

const BASE_COUNTRIES_BY_DIAL_DESC = [...BASE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

const TRUNK_PREFIX_COUNTRIES = new Set(["TR","GB","DE","IT","FR","ES","PT","NL","BE","SE","NO","DK","FI","AT","CH","PL","CZ","SK","HU","RO","BG","GR"]);

function detectCountry(value: string | undefined, countries: Country[], byDialDesc: Country[]): Country {
  const v = (value || "").replace(/\s+/g, "");
  if (v.startsWith("+")) {
    const match = byDialDesc.find(c => v.startsWith(c.dial));
    if (match) return match;
  }
  return countries.find(c => c.code === "TR") || countries[0];
}

type Props = {
  value?: string;
  onChange: (e164: string) => void;
  id?: string;
  placeholder?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  lang?: "tr" | "en";
  displayLabel?: string;
};

export default function PhoneInput({ value = "", onChange, id, placeholder, name, required, disabled, lang: langProp }: Props) {
  const ctx = useLang();
  const lang = langProp ?? ctx.lang;

  const [countries, setCountries] = useState<Country[]>(BASE_COUNTRIES);
  const [countriesByDialDesc, setCountriesByDialDesc] = useState<Country[]>(BASE_COUNTRIES_BY_DIAL_DESC);

  useEffect(() => {
    let cancelled = false;
    if (typeof Intl === "undefined" || typeof Intl.DisplayNames !== "function") {
      setCountries(BASE_COUNTRIES);
      setCountriesByDialDesc(BASE_COUNTRIES_BY_DIAL_DESC);
      return;
    }
    try {
      const display = new Intl.DisplayNames([lang], { type: "region" });
      const localized = BASE_COUNTRIES.map(c => ({
        ...c,
        name: display.of(c.code) || c.code,
      }));
      if (!cancelled) {
        setCountries(localized);
        setCountriesByDialDesc([...localized].sort((a, b) => b.dial.length - a.dial.length));
      }
    } catch {
      if (!cancelled) {
        setCountries(BASE_COUNTRIES);
        setCountriesByDialDesc(BASE_COUNTRIES_BY_DIAL_DESC);
      }
    }
    return () => { cancelled = true; };
  }, [lang]);

  const [country, setCountry] = useState<Country>(() => detectCountry(value, BASE_COUNTRIES, BASE_COUNTRIES_BY_DIAL_DESC));

  useEffect(() => {
    setCountry(detectCountry(value, countries, countriesByDialDesc));
  }, [value, countries, countriesByDialDesc]);

  const dial = country.dial;

  const localValue = useMemo(() => {
    const v = (value || "").replace(/\s+/g, "");
    if (v.startsWith("+")) {
      const cc = dial.replace("+", "");
      const digits = v.replace(/^\+/, "").replace(/\D+/g, "");
      return digits.startsWith(cc) ? digits.slice(cc.length) : digits;
    }
    return v.replace(/\D+/g, "");
  }, [value, dial]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const ccDigits = useMemo(() => dial.replace("+", ""), [dial]);

  const setLocal = (inputStr: string) => {
    const cc = dial.replace("+", "");
    const typed = inputStr.replace(/[^\d+]/g, "");
    const onlyDigits = typed.replace(/\D+/g, "");
    let national = onlyDigits.startsWith(cc) ? onlyDigits.slice(cc.length) : onlyDigits;
    const ex = getExampleNumber(country.code as any, examples as any);
    const expected = ex ? String((ex as any).nationalNumber).length : undefined;
    const maxLocal = expected ?? Math.max(0, 15 - cc.length);
    if (national.length > maxLocal) national = national.slice(0, maxLocal);
    const e164Local = TRUNK_PREFIX_COUNTRIES.has(country.code) && national.startsWith("0") ? national.slice(1) : national;
    const e164 = `+${cc}${e164Local}`;
    onChange(e164);
  };

  const displayValue = useMemo(() => {
    if (!localValue) return "";
    const cc = dial.replace("+", "");
    const e164Local = TRUNK_PREFIX_COUNTRIES.has(country.code) && localValue.startsWith("0") ? localValue.slice(1) : localValue;
    const e164 = `+${cc}${e164Local}`;
    const a = new AsYouType(undefined as any);
    return a.input(e164);
  }, [dial, localValue, country]);

  const ph = useMemo(() => {
    try {
      const ex = getExampleNumber(country.code as any, examples as any);
      if (ex) {
        const cc = dial.replace("+", "");
        const sample = `+${cc}${String((ex as any).nationalNumber)}`;
        const a = new AsYouType(undefined as any);
        return a.input(sample);
      }
    } catch {}
    return lang === "tr" ? "+90 xxx xxx xx xx" : "+1 xxx xxx xxxx";
  }, [country, dial, lang]);

  const completeness = useMemo(() => {
    const cc = dial.replace("+", "");
    const raw = localValue.replace(/\D+/g, "");
    const digits = TRUNK_PREFIX_COUNTRIES.has(country.code) && raw.startsWith("0") ? raw.slice(1) : raw;
    const e164 = `+${cc}${digits}`;
    const valid = digits.length > 0 && isValidPhoneNumber(e164 as any);
    return { valid, digitsLen: raw.length, e164 };
  }, [localValue, dial, country]);

  return (
    <div className="flex gap-2 items-stretch">
      <select
        className="w-44 rounded-xl border border-border bg-card px-3 h-11 text-sm shadow-sm dark:bg-white/10"
        value={country.code}
        onChange={(e) => {
          const next = countries.find(c => c.code === e.target.value) || country;
          setCountry(next);
          const digits = localValue.replace(/\D+/g, "");
          onChange(digits ? `${next.dial}${digits}` : next.dial);
          requestAnimationFrame(() => {
            const el = inputRef.current; if (!el) return; el.focus();
            const len = el.value.length; try { el.setSelectionRange(len, len); } catch {}
          });
        }}
      >
        {countries.map(c => (
          <option key={c.code} value={c.code}>{`${c.dial} – ${c.name}`}</option>
        ))}
      </select>
      <div className="flex-1">
        <input
          id={id}
          name={name}
          ref={inputRef}
          className={`w-full rounded-xl border bg-card px-3 py-2 h-11 shadow-sm ${completeness.digitsLen > 0 && !completeness.valid ? 'border-primary' : 'border-border'} dark:bg-white/10`}
          aria-invalid={completeness.digitsLen > 0 && !completeness.valid}
          inputMode="tel"
          placeholder={placeholder || ph}
          required={required}
          disabled={disabled}
          value={displayValue}
          onChange={(e) => setLocal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Backspace' && e.key !== 'Delete') return;
            const el = inputRef.current; if (!el) return;
            const formatted = el.value;
            const caret = el.selectionStart ?? formatted.length;
            const posToDigitIndex: number[] = [];
            let di = -1;
            for (let i = 0; i < formatted.length; i++) {
              if (/\d/.test(formatted[i])) di++;
              posToDigitIndex[i] = di;
            }
            let targetDigitIndex = -1;
            if (e.key === 'Backspace') {
              let i = Math.min(caret - 1, formatted.length - 1);
              for (; i >= 0; i--) { if (/\d/.test(formatted[i])) { targetDigitIndex = posToDigitIndex[i]; break; } }
            } else {
              let i = Math.max(0, caret);
              for (; i < formatted.length; i++) { if (/\d/.test(formatted[i])) { targetDigitIndex = posToDigitIndex[i]; break; } }
            }
            if (targetDigitIndex < 0) return;
            const ccLen = ccDigits.length;
            if (targetDigitIndex < ccLen) { e.preventDefault(); return; }
            e.preventDefault();
            const allDigits = formatted.replace(/\D+/g, '');
            const national = allDigits.slice(ccLen);
            const localIndex = targetDigitIndex - ccLen;
            const nextNational = national.slice(0, localIndex) + national.slice(localIndex + 1);
            const e164Local = TRUNK_PREFIX_COUNTRIES.has(country.code) && nextNational.startsWith('0') ? nextNational.slice(1) : nextNational;
            const nextE164 = `+${ccDigits}${e164Local}`;
            onChange(nextE164);
            requestAnimationFrame(() => {
              const el2 = inputRef.current; if (!el2) return;
              const newFmt = el2.value;
              const map: number[] = []; let dIdx = -1; let pos = newFmt.length;
              for (let i = 0; i < newFmt.length; i++) {
                if (/\d/.test(newFmt[i])) {
                  dIdx++; map[i] = dIdx;
                  if (dIdx === targetDigitIndex) { pos = i; break; }
                } else {
                  map[i] = dIdx;
                }
              }
              try { el2.setSelectionRange(pos, pos); } catch {}
            });
          }}
        />
        <div className="mt-1 text-xs space-y-0.5">
          {!completeness.valid && completeness.digitsLen > 0 ? (
            <div className="text-primary">{lang === 'tr' ? 'Geçerli bir telefon numarası girin.' : 'Enter a valid phone number.'}</div>
          ) : completeness.valid && completeness.digitsLen > 0 ? (
            <div className="text-green-600">{lang === 'tr' ? 'Numara geçerli.' : 'Number is valid.'}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
