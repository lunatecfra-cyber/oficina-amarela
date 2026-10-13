export function isLikelyUrl(v: string) {
  return /^(https?:\/\/|www\.)/i.test(v.trim());
}

export function isDriveUrl(v: string) {
  return /drive\.google\.com/i.test(v.trim());
}

export function isYouTubeUrl(v: string) {
  return /(youtube\.com|youtu\.be)/i.test(v.trim());
}

export function publishedPortfolioLink(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.pathname.startsWith("/api/missions/") ||
      Array.from(url.searchParams.keys()).some((key) => key.toLowerCase() === "x-amz-signature")
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
