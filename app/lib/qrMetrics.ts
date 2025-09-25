const STORAGE_KEY = "qr_total_generated";

const memoryFallback = { value: 0 };

declare global {
  interface Window {
    __qrMetrics?: {
      getQrCount: () => number;
      incrementQrCount: () => void;
    };
  }
}

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const ensureGlobalApi = () => {
  if (!isBrowser()) return;
  if (!window.__qrMetrics) {
    window.__qrMetrics = {
      getQrCount,
      incrementQrCount,
    };
  }
};

export function getQrCount(): number {
  if (isBrowser()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? parseInt(raw, 10) : 0;
      ensureGlobalApi();
      return Number.isNaN(parsed) ? 0 : parsed;
    } catch {
      return memoryFallback.value;
    }
  }
  return memoryFallback.value;
}

export function incrementQrCount(): void {
  if (isBrowser()) {
    try {
      const next = getQrCount() + 1;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      ensureGlobalApi();
      return;
    } catch {
      // fall through to memory fallback
    }
  }
  memoryFallback.value += 1;
}
