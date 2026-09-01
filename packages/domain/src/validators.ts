export function isLikelyUrl(v: string) {
  return /^(https?:\/\/|www\.)/i.test(v.trim());
}

export function isDriveUrl(v: string) {
  return /drive\.google\.com/i.test(v.trim());
}

export function isYouTubeUrl(v: string) {
  return /(youtube\.com|youtu\.be)/i.test(v.trim());
}
