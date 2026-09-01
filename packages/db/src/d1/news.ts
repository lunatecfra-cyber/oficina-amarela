import { LIMITS, limitStr } from "@oficina/domain/limits";
import type { DbNews, NewsRepository } from "../news.ts";
import type { D1DatabaseLike } from "./types.ts";

export function createD1News(db: D1DatabaseLike): NewsRepository {
  return {
    async getPublishedNews(limit = 4): Promise<DbNews[]> {
      try {
        const result = await db
          .prepare(
            `SELECT n.id, n.title, n.body, n.is_published, n.created_at, u.handle AS author
             FROM news n
             LEFT JOIN users u ON u.id = n.author_id
             WHERE n.is_published = 1 OR n.is_published = true
             ORDER BY n.created_at DESC
             LIMIT ?`,
          )
          .bind(limit)
          .all<{
            id: number;
            title?: string;
            body?: string;
            is_published?: number | boolean;
            created_at?: string;
            author?: string | null;
            // legacy
            titulo?: string;
            texto?: string;
            publicada?: number | boolean;
            criada_em?: string;
            autor?: string | null;
          }>();

        return (result.results ?? []).map((l) => {
          const title = String(l.title ?? l.titulo ?? "");
          const body = String(l.body ?? l.texto ?? "");
          const isPublished = Boolean(l.is_published ?? l.publicada);
          const createdAt = new Date(l.created_at ?? l.criada_em ?? Date.now()).toISOString();
          const author = (l.author ?? l.autor) ? String(l.author ?? l.autor) : null;
          return {
            id: Number(l.id),
            title,
            text: body,
            isPublished,
            published: isPublished,
            createdAt,
            author,
            titulo: title,
            texto: body,
            publicada: isPublished,
            criadaEm: createdAt,
          };
        });
      } catch {
        return [];
      }
    },

    async getAllNews(): Promise<DbNews[]> {
      try {
        const result = await db
          .prepare(
            `SELECT n.id, n.title, n.body, n.is_published, n.created_at, u.handle AS author
             FROM news n
             LEFT JOIN users u ON u.id = n.author_id
             ORDER BY n.created_at DESC`,
          )
          .all<{
            id: number;
            title?: string;
            body?: string;
            is_published?: number | boolean;
            created_at?: string;
            author?: string | null;
            titulo?: string;
            texto?: string;
            publicada?: number | boolean;
            criada_em?: string;
            autor?: string | null;
          }>();

        return (result.results ?? []).map((l) => {
          const title = String(l.title ?? l.titulo ?? "");
          const body = String(l.body ?? l.texto ?? "");
          const isPublished = Boolean(l.is_published ?? l.publicada);
          const createdAt = new Date(l.created_at ?? l.criada_em ?? Date.now()).toISOString();
          const author = (l.author ?? l.autor) ? String(l.author ?? l.autor) : null;
          return {
            id: Number(l.id),
            title,
            text: body,
            isPublished,
            published: isPublished,
            createdAt,
            author,
            titulo: title,
            texto: body,
            publicada: isPublished,
            criadaEm: createdAt,
          };
        });
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
          `INSERT INTO news (title, body, author_id, is_published)
           VALUES (?, ?, ?, ?)
           RETURNING id`,
        )
        .bind(t, c, authorId, isPublished ? 1 : 0)
        .first<{ id: number }>();

      return { ok: true, id: Number(row?.id) };
    },

    async toggleNewsPublication(id: number) {
      const current = await db
        .prepare("SELECT is_published FROM news WHERE id = ?")
        .bind(id)
        .first<{ is_published: number | boolean }>();
      if (!current)
        return { ok: false, error: "Novidade não encontrada.", erro: "Novidade não encontrada." };
      const currentVal = current.is_published;
      const nextVal = currentVal ? 0 : 1;
      await db.prepare("UPDATE news SET is_published = ? WHERE id = ?").bind(nextVal, id).run();
      return {
        ok: true,
        isPublished: Boolean(nextVal),
        published: Boolean(nextVal),
        publicada: Boolean(nextVal),
      };
    },

    async deleteNews(id: number) {
      const row = await db
        .prepare("DELETE FROM news WHERE id = ? RETURNING id")
        .bind(id)
        .first<{ id: number }>();
      if (!row)
        return { ok: false, error: "Novidade não encontrada.", erro: "Novidade não encontrada." };
      return { ok: true };
    },
  };
}
