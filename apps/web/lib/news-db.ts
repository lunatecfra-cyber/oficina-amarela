import type { DbNews } from "@oficina/db/news";
import { fetchApi, fetchApiJson, fetchPublicApiJson } from "@/lib/internal-api";

export type { DbNews };
export type NewsItemDb = DbNews;
export type NovidadeDb = DbNews;

export async function getPublishedNews(limit = 4): Promise<DbNews[]> {
  // Novidade publicada é pública: sem cookie, a home continua cacheável.
  const list = await fetchPublicApiJson<DbNews[]>(`/news?limit=${limit}`);
  return list ?? [];
}
export const publishedNews = getPublishedNews;
export const novidadesPublicadas = getPublishedNews;

export async function getAllNews(): Promise<DbNews[]> {
  const list = await fetchApiJson<DbNews[]>("/admin/news");
  return list ?? [];
}
export const allNews = getAllNews;
export const todasNovidades = getAllNews;

export async function createNews(
  _authorId: number,
  title: string,
  text: string,
  isPublished = true,
): Promise<{ ok: true; id: number } | { ok: false; error: string; erro?: string }> {
  const res = await fetchApi("/admin/news", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title, text, isPublished }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    id?: number;
    error?: string;
    erro?: string;
  };
  if (!res.ok || !body.ok) {
    const err = body.error ?? body.erro ?? "Erro ao criar novidade.";
    return { ok: false, error: err, erro: err };
  }
  return { ok: true, id: Number(body.id) };
}
export const criarNovidade = createNews;
export const createNewsArticle = createNews;

export async function toggleNewsPublication(
  id: number,
): Promise<
  | { ok: true; isPublished: boolean; published?: boolean; publicada?: boolean }
  | { ok: false; error: string; erro?: string }
> {
  const res = await fetchApi(`/admin/news/${id}/toggle`, { method: "POST" });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    isPublished?: boolean;
    published?: boolean;
    publicada?: boolean;
    error?: string;
    erro?: string;
  };
  if (!res.ok || !body.ok) {
    const err = body.error ?? body.erro ?? "Erro ao alternar publicação.";
    return { ok: false, error: err, erro: err };
  }
  return {
    ok: true,
    isPublished: Boolean(body.isPublished),
    published: Boolean(body.isPublished),
    publicada: Boolean(body.isPublished),
  };
}
export const alternarPublicacao = toggleNewsPublication;

export async function deleteNews(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const res = await fetchApi(`/admin/news/${id}`, { method: "DELETE" });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    erro?: string;
  };
  if (!res.ok || !body.ok) {
    const err = body.error ?? body.erro ?? "Erro ao apagar novidade.";
    return { ok: false, error: err, erro: err };
  }
  return { ok: true };
}
export const apagarNovidade = deleteNews;
export const deleteNewsArticle = deleteNews;
