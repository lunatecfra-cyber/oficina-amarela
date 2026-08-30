import type { MusicRepository, MusicTrack } from "../music.ts";
import type { D1DatabaseLike } from "./types.ts";

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [raw];
    }
  }
  return [];
}

export function createD1Music(db: D1DatabaseLike): MusicRepository {
  return {
    async listMusicTracks(filterTag?: string): Promise<MusicTrack[]> {
      const query = filterTag
        ? db
            .prepare(
              `SELECT m.id, m.nome, m.tags, m.url, m.tamanho, m.adicionado_por, m.criado_em
             FROM musicas m, json_each(m.tags)
             WHERE json_each.value = ?
             ORDER BY m.criado_em DESC`,
            )
            .bind(filterTag)
        : db.prepare(
            `SELECT id, nome, tags, url, tamanho, adicionado_por, criado_em
             FROM musicas
             ORDER BY criado_em DESC`,
          );

      const result = await query.all<{
        id: string;
        nome: string;
        tags: unknown;
        url: string;
        tamanho: number | null;
        adicionado_por: string | null;
        criado_em: string;
      }>();

      return (result.results ?? []).map((r) => ({
        id: String(r.id),
        name: String(r.nome),
        tags: parseTags(r.tags),
        url: String(r.url),
        size: r.tamanho === null ? null : Number(r.tamanho),
        added_by: r.adicionado_por ? String(r.adicionado_por) : null,
        created_at: String(r.criado_em),
        nome: String(r.nome),
        tamanho: r.tamanho === null ? null : Number(r.tamanho),
        adicionado_por: r.adicionado_por ? String(r.adicionado_por) : null,
        criado_em: String(r.criado_em),
      }));
    },

    async addMusicTrack(name, tags, url, size, addedBy) {
      await db
        .prepare(
          `INSERT INTO musicas (nome, tags, url, tamanho, adicionado_por)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(name, JSON.stringify(tags), url, size, addedBy)
        .run();
    },

    async getAllMusicTags(): Promise<string[]> {
      try {
        const result = await db
          .prepare(
            `SELECT DISTINCT json_each.value AS tag
             FROM musicas, json_each(musicas.tags)
             ORDER BY tag`,
          )
          .all<{ tag: string }>();
        return (result.results ?? []).map((r) => String(r.tag));
      } catch {
        return [];
      }
    },
  };
}
