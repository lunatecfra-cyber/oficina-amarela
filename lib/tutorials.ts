export type TutorialType = "drive" | "delivery" | "entrega";
export type TipoTutorial = TutorialType;

export const VIDEOS: Record<string, string> = {
  drive: "",
  delivery: "",
  entrega: "",
};

export function getEmbedUrl(link: string): string | null {
  const raw = link.trim();
  if (!raw) return null;

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;

  const host = u.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    return isValidYouTubeId(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = u.searchParams.get("v") ?? u.pathname.replace(/^\/embed\//, "");
    return isValidYouTubeId(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }

  if (host === "drive.google.com") {
    const id = u.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/)?.[1];
    return id ? `https://drive.google.com/file/d/${id}/preview` : null;
  }

  return null;
}

export const embedUrl = getEmbedUrl;
export const urlDeEmbutir = getEmbedUrl;

function isValidYouTubeId(id: string) {
  return /^[A-Za-z0-9_-]{11}$/.test(id);
}
