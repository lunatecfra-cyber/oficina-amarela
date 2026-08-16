/**
 * Os vídeos dos tutoriais.
 *
 * ── PRA PÔR UM VÍDEO, MEXA SÓ AQUI ──────────────────────────────────
 * Cole o link normal (o que o YouTube ou o Drive mostram na barra de
 * endereço) dentro das aspas. Publicou, apareceu. Vazio, a tela mostra a
 * animação — nunca fica um buraco.
 *
 * Exemplos de link que funcionam:
 *   https://www.youtube.com/watch?v=XXXXXXXXXXX
 *   https://youtu.be/XXXXXXXXXXX
 *   https://drive.google.com/file/d/XXXXXXXX/view
 * ────────────────────────────────────────────────────────────────────
 */
export const VIDEOS: Record<TipoTutorial, string> = {
  drive: "",
  entrega: "",
};

export type TipoTutorial = "drive" | "entrega";

/**
 * Transforma o link normal no endereço que dá pra embutir.
 *
 * Só YouTube e Google Drive passam. Não é preciosismo: o que entra aqui vira
 * um <iframe>, e iframe de terceiro executa código dentro da nossa página. Se
 * alguém colar um link errado (ou de qualquer outro lugar), a função devolve
 * null e a tela cai na animação — em vez de embutir o que apareceu.
 */
export function urlDeEmbutir(link: string): string | null {
  const bruto = link.trim();
  if (!bruto) return null;

  let u: URL;
  try {
    u = new URL(bruto);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;

  const host = u.hostname.replace(/^www\./, "");

  // youtu.be/ID
  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    return idDeYoutubeValido(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }

  // youtube.com/watch?v=ID  e  youtube.com/embed/ID
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id = u.searchParams.get("v") ?? u.pathname.replace(/^\/embed\//, "");
    return idDeYoutubeValido(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }

  // drive.google.com/file/d/ID/view  →  /preview (o único que toca embutido)
  if (host === "drive.google.com") {
    const id = u.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/)?.[1];
    return id ? `https://drive.google.com/file/d/${id}/preview` : null;
  }

  return null;
}

/** id do YouTube é sempre 11 caracteres de um alfabeto conhecido */
function idDeYoutubeValido(id: string) {
  return /^[A-Za-z0-9_-]{11}$/.test(id);
}
