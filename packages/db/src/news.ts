import { LIMITS, limitStr } from "@oficina/domain/limits";
import { sql } from "./client.ts";

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
  id: Number(l.id),
  title: String(l.titulo),
  text: String(l.texto),
  isPublished: Boolean(l.publicada),
  published: Boolean(l.publicada),
  createdAt: new Date(l.criada_em).toISOString(),
  author: l.autor ? String(l.autor) : null,
  titulo: String(l.titulo),
  texto: String(l.texto),
  publicada: Boolean(l.publicada),
  criadaEm: new Date(l.criada_em).toISOString(),
});

export type NewsRepository = {
  getPublishedNews(limit?: number): Promise<DbNews[]>;
  getAllNews(): Promise<DbNews[]>;
  createNews(
    authorId: number,
    title: string,
    text: string,
    isPublished?: boolean,
  ): Promise<{ ok: true; id: number } | { ok: false; error: string; erro?: string }>;
  toggleNewsPublication(
    id: number,
  ): Promise<
    | { ok: true; isPublished: boolean; published?: boolean; publicada?: boolean }
    | { ok: false; error: string; erro?: string }
  >;
  deleteNews(id: number): Promise<{ ok: true } | { ok: false; error: string; erro?: string }>;
};

export const postgresNews: NewsRepository = {
  async getPublishedNews(limit = 4): Promise<DbNews[]> {
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
  },

  async getAllNews(): Promise<DbNews[]> {
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
  },

  async createNews(authorId: number, title: string, text: string, isPublished = true) {
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
    if (!row) {
      return {
        ok: false,
        error: "Não foi possível criar a novidade. Tente de novo.",
        erro: "Não foi possível criar a novidade. Tente de novo.",
      };
    }
    return { ok: true, id: Number(row.id) };
  },

  async toggleNewsPublication(id: number) {
    const [row] = await sql`
      UPDATE novidades SET publicada = NOT publicada WHERE id = ${id}
      RETURNING publicada
    `;
    if (!row)
      return { ok: false, error: "Novidade não encontrada.", erro: "Novidade não encontrada." };
    return {
      ok: true,
      isPublished: Boolean(row.publicada),
      published: Boolean(row.publicada),
      publicada: Boolean(row.publicada),
    };
  },

  async deleteNews(id: number) {
    const rows = await sql`DELETE FROM novidades WHERE id = ${id} RETURNING id`;
    if (rows.length === 0)
      return { ok: false, error: "Novidade não encontrada.", erro: "Novidade não encontrada." };
    return { ok: true };
  },
};
