export function sanitizeAscii(input: string): string {
  if (typeof input !== 'string') return input as any;
  let s = input.replace(/ı/g, 'i').replace(/İ/g, 'I');
  try { s = s.normalize('NFD').replace(/\p{M}+/gu, ''); } catch {}
  return s.replace(/[^\n\r\t\x20-\x7E]/g, '');
}

