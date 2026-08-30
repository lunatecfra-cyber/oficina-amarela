export const LIMITS = {
  name: 80,
  handle: 24,
  email: 254,
  location: 80,
  bio: 600,
  headline: 60,
  title: 120,
  briefField: 120,
  longText: 2000,
  link: 500,
  tag: 60,
  message: 800,
  report: 1000,
} as const;

export const SLOTS = {
  editor: 50,
  spokesperson: 80,
  voz: 80,
} as const;

export const ROLE_LIMITS = SLOTS;
export const LIMITES_PAPEL = SLOTS;

export function limitStr(value: string | null | undefined, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export const limitString = limitStr;
export const limitarTexto = limitStr;

export function limitOrNull(value: string | null | undefined, max: number): string | null {
  const t = limitStr(value, max);
  return t === "" ? null : t;
}

export function limitList(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  const clean = value
    .filter((x): x is string => typeof x === "string")
    .map((x) => limitStr(x, LIMITS.tag))
    .filter(Boolean);
  return [...new Set(clean)].slice(0, maxItems);
}

export const MAX_PHOTO_BYTES = 2_000_000;

const PHOTO_FORMATS = ["data:image/png", "data:image/jpeg", "data:image/webp", "data:image/gif"];

export function isValidPhoto(dataUrl: string | undefined | null): boolean {
  if (!dataUrl) return true;
  if (!PHOTO_FORMATS.some((f) => dataUrl.startsWith(f))) return false;
  return dataUrl.length <= MAX_PHOTO_BYTES;
}
