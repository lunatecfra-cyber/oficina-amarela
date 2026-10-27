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

export function limitStr(value: string | null | undefined, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

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

export function isValidPhoto(dataUrl: string | undefined | null): boolean {
  if (dataUrl === undefined || dataUrl === null || dataUrl === "") return true;
  if (typeof dataUrl !== "string" || dataUrl.length > MAX_PHOTO_BYTES) return false;
  const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || match[2].length % 4 !== 0) return false;
  try {
    const header = atob(match[2].slice(0, 24));
    switch (match[1]) {
      case "png":
        return header.startsWith("\x89PNG\r\n\x1a\n");
      case "jpeg":
        return header.startsWith("\xff\xd8\xff");
      case "gif":
        return header.startsWith("GIF87a") || header.startsWith("GIF89a");
      case "webp":
        return header.startsWith("RIFF") && header.slice(8, 12) === "WEBP";
      default:
        return false;
    }
  } catch {
    return false;
  }
}
