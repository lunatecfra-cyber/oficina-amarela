import { sql } from "@/lib/db";
import { LIMITS, limitStr } from "@/lib/limits";

export type DbNews = {
  id: number;
  title: string;
  text: string;
  isPublished: boolean;
  published?: boolean;
  createdAt: string;
  author: string | null;
  // aliases
  titulo?: string;
  texto?: string;
  publicada?: boolean;
  criadaEm?: string;
};
export type NewsItemDb = DbNews;
export type NovidadeDb = DbNews;

type Row = {
  id: number;
  title: string;
  text: string;
  is_published: boolean;
  created_at: string;
  author: string | null;
};

const rowToDbNews = (l: Row): DbNews => ({
  id: l.id,
  title: l.title,
  text: l.text,
  isPublished: l.is_published,
  published: l.is_published,
  createdAt: new Date(l.created_at).toISOString(),
  author: l.author,
  titulo: l.title,
  texto: l.text,
  publicada: l.is_published,
  criadaEm: new Date(l.created_at).toISOString(),
});

export async function getPublishedNews(limit = 4): Promise<DbNews[]> {
  try {
    const rows = await sql`
      SELECT n.id, n.title, n.text, n.is_published, n.created_at, u.handle AS author
      FROM news n
      LEFT JOIN users u ON u.id = n.author_id
      WHERE n.is_published = true
      ORDER BY n.created_at DESC
      LIMIT ${limit}
    `;
    return (rows as unknown as Row[]).map(rowToDbNews);
  } catch {
    return [];
  }
}

export const publishedNews = getPublishedNews;
export const novidadesPublicadas = getPublishedNews;

export async function getAllNews(): Promise<DbNews[]> {
  try {
    const rows = await sql`
      SELECT n.id, n.title, n.text, n.is_published, n.created_at, u.handle AS author
      FROM news n
      LEFT JOIN users u ON u.id = n.author_id
      ORDER BY n.created_at DESC
    `;
    return (rows as unknown as Row[]).map(rowToDbNews);
  } catch {
    return [];
  }
}

export const allNews = getAllNews;
export const todasNovidades = getAllNews;

export async function createNews(
  authorId: number,
  title: string,
  text: string,
  isPublished = true
): Promise<{ ok: true; id: number } | { ok: false; error: string; erro?: string }> {
  const t = limitStr(title, LIMITS.title);
  const c = limitStr(text, LIMITS.longText);
  if (!t) return { ok: false, error: "Please enter a title.", erro: "Please enter a title." };
  if (!c) return { ok: false, error: "Please enter the news text.", erro: "Please enter the news text." };

  const [row] = await sql`
    INSERT INTO news (title, text, author_id, is_published)
    VALUES (${t}, ${c}, ${authorId}, ${isPublished})
    RETURNING id
  `;
  return { ok: true, id: row.id };
}

export const criarNovidade = createNews;

export async function toggleNewsPublication(
  id: number
): Promise<{ ok: true; isPublished: boolean; published?: boolean; publicada?: boolean } | { ok: false; error: string; erro?: string }> {
  const [row] = await sql`
    UPDATE news SET is_published = NOT is_published WHERE id = ${id}
    RETURNING is_published
  `;
  if (!row) return { ok: false, error: "News item not found.", erro: "News item not found." };
  return { ok: true, isPublished: row.is_published, published: row.is_published, publicada: row.is_published };
}

export const alternarPublicacao = toggleNewsPublication;

export async function deleteNews(id: number): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const rows = await sql`DELETE FROM news WHERE id = ${id} RETURNING id`;
  if (rows.length === 0) return { ok: false, error: "News item not found.", erro: "News item not found." };
  return { ok: true };
}

export const apagarNovidade = deleteNews;

export const deleteNewsArticle = deleteNews;
export const createNewsArticle = createNews;
