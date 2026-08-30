import { LIMITS, limitStr } from "@oficina/domain/limits";
import type { DbNews, NewsRepository } from "../news.ts";
import type { D1DatabaseLike } from "./types.ts";

export function createD1News(db: D1DatabaseLike): NewsRepository {
  return {
    async getPublishedNews(limit = 4): Promise<DbNews[]> {
      try {
        const result = await db
          .prepare(
            `SELECT n.id, n.titulo, n.texto, n.publicada, n.criada_em, u.apelido AS autor
             FROM novidades n
             LEFT JOIN users u ON u.id = n.autor_id
             WHERE n.publicada = 1 OR n.publicada = true
             ORDER BY n.criada_em DESC
             LIMIT ?`,
          )
          .bind(limit)
          .all<{
            id: number;
            titulo: string;
            texto: string;
            publicada: number | boolean;
            criada_em: string;
            autor: string | null;
          }>();

        return (result.results ?? []).map((l) => ({
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
        }));
      } catch {
        return [];
      }
    },

    async getAllNews(): Promise<DbNews[]> {
      try {
        const result = await db
          .prepare(
            `SELECT n.id, n.titulo, n.texto, n.publicada, n.criada_em, u.apelido AS autor
             FROM novidades n
             LEFT JOIN users u ON u.id = n.autor_id
             ORDER BY n.criada_em DESC`,
          )
          .all<{
            id: number;
            titulo: string;
            texto: string;
            publicada: number | boolean;
            criada_em: string;
            autor: string | null;
          }>();

        return (result.results ?? []).map((l) => ({
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
        }));
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

      const row = await db
        .prepare(
          `INSERT INTO novidades (titulo, texto, autor_id, publicada)
           VALUES (?, ?, ?, ?)
           RETURNING id`,
        )
        .bind(t, c, authorId, isPublished ? 1 : 0)
        .first<{ id: number }>();

      return { ok: true, id: Number(row?.id) };
    },

    async toggleNewsPublication(id: number) {
      const current = await db
        .prepare("SELECT publicada FROM novidades WHERE id = ?")
        .bind(id)
        .first<{ publicada: number | boolean }>();
      if (!current)
        return { ok: false, error: "Novidade não encontrada.", erro: "Novidade não encontrada." };
      const nextVal = current.publicada ? 0 : 1;
      await db.prepare("UPDATE novidades SET publicada = ? WHERE id = ?").bind(nextVal, id).run();
      return {
        ok: true,
        isPublished: Boolean(nextVal),
        published: Boolean(nextVal),
        publicada: Boolean(nextVal),
      };
    },

    async deleteNews(id: number) {
      const row = await db
        .prepare("DELETE FROM novidades WHERE id = ? RETURNING id")
        .bind(id)
        .first<{ id: number }>();
      if (!row)
        return { ok: false, error: "Novidade não encontrada.", erro: "Novidade não encontrada." };
      return { ok: true };
    },
  };
}
