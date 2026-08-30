import { LIMITS, limitStr } from "@oficina/domain/limits";
import { sql } from "@/lib/db";

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
  titulo: string;
  texto: string;
  publicada: boolean;
  criada_em: string;
  autor: string | null;
};

const rowToDbNews = (l: Row): DbNews => ({
  id: l.id,
  title: l.titulo,
  text: l.texto,
  isPublished: l.publicada,
  published: l.publicada,
  createdAt: new Date(l.criada_em).toISOString(),
  author: l.autor,
  titulo: l.titulo,
  texto: l.texto,
  publicada: l.publicada,
  criadaEm: new Date(l.criada_em).toISOString(),
});

export async function getPublishedNews(limit = 4): Promise<DbNews[]> {
  try {
    const rows = await sql`
      SELECT n.id, n.titulo, n.texto, n.publicada, n.criada_em, u.apelido AS autor
      FROM novidades n
      LEFT JOIN users u ON u.id = n.autor_id
      WHERE n.publicada = true
      ORDER BY n.criada_em DESC
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
      SELECT n.id, n.titulo, n.texto, n.publicada, n.criada_em, u.apelido AS autor
      FROM novidades n
      LEFT JOIN users u ON u.id = n.autor_id
      ORDER BY n.criada_em DESC
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
  isPublished = true,
): Promise<{ ok: true; id: number } | { ok: false; error: string; erro?: string }> {
  const t = limitStr(title, LIMITS.title);
  const c = limitStr(text, LIMITS.longText);
  if (!t) return { ok: false, error: "Escreva um título.", erro: "Escreva um título." };
  if (!c)
    return {
      ok: false,
      error: "Escreva o texto da novidade.",
      erro: "Escreva o texto da novidade.",
    };

  const [row] = await sql`
    INSERT INTO novidades (titulo, texto, autor_id, publicada)
    VALUES (${t}, ${c}, ${authorId}, ${isPublished})
    RETURNING id
  `;
  return { ok: true, id: row.id };
}

export const criarNovidade = createNews;

export async function toggleNewsPublication(
  id: number,
): Promise<
  | { ok: true; isPublished: boolean; published?: boolean; publicada?: boolean }
  | { ok: false; error: string; erro?: string }
> {
  const [row] = await sql`
    UPDATE novidades SET publicada = NOT publicada WHERE id = ${id}
    RETURNING publicada
  `;
  if (!row)
    return { ok: false, error: "Novidade não encontrada.", erro: "Novidade não encontrada." };
  return {
    ok: true,
    isPublished: row.publicada,
    published: row.publicada,
    publicada: row.publicada,
  };
}

export const alternarPublicacao = toggleNewsPublication;

export async function deleteNews(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const rows = await sql`DELETE FROM novidades WHERE id = ${id} RETURNING id`;
  if (rows.length === 0)
    return { ok: false, error: "Novidade não encontrada.", erro: "Novidade não encontrada." };
  return { ok: true };
}

export const apagarNovidade = deleteNews;
export const deleteNewsArticle = deleteNews;
export const createNewsArticle = createNews;
