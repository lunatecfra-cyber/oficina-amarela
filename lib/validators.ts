/** Verifica se a string parece uma URL (http, https ou www). */
export function pareceLink(v: string) {
  return /^(https?:\/\/|www\.)/i.test(v.trim());
}

/** Verifica se a string é um link do Google Drive. */
export function pareceLinkDrive(v: string) {
  return /drive\.google\.com/i.test(v.trim());
}

/** Verifica se a string é um link do YouTube. */
export function pareceLinkYoutube(v: string) {
  return /(youtube\.com|youtu\.be)/i.test(v.trim());
}
