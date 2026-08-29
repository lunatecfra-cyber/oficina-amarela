export function isLikelyUrl(v: string) {
  return /^(https?:\/\/|www\.)/i.test(v.trim());
}
export const looksLikeLink = isLikelyUrl;
export const pareceLink = isLikelyUrl;

export function isDriveUrl(v: string) {
  return /drive\.google\.com/i.test(v.trim());
}
export const looksLikeDriveLink = isDriveUrl;
export const pareceLinkDrive = isDriveUrl;

export function isYouTubeUrl(v: string) {
  return /(youtube\.com|youtu\.be)/i.test(v.trim());
}
export const looksLikeYoutubeLink = isYouTubeUrl;
export const pareceLinkYoutube = isYouTubeUrl;
