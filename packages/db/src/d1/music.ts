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
              `SELECT m.id, m.name, m.tags, m.url, m.size_bytes, m.added_by, m.created_at
               FROM music_tracks m, json_each(m.tags)
               WHERE json_each.value = ?
               ORDER BY m.created_at DESC`,
            )
            .bind(filterTag)
        : db.prepare(
            `SELECT id, name, tags, url, size_bytes, added_by, created_at
             FROM music_tracks
             ORDER BY created_at DESC`,
          );

      const result = await query.all<{
        id: string;
        name?: string;
        tags: unknown;
        url: string;
        size_bytes?: number | null;
        added_by?: string | null;
        created_at?: string;
        // legacy
        nome?: string;
        tamanho?: number | null;
        adicionado_por?: string | null;
        criado_em?: string;
      }>();

      return (result.results ?? []).map((r) => {
        const name = String(r.name ?? r.nome ?? "");
        const size = (r.size_bytes ?? r.tamanho) == null ? null : Number(r.size_bytes ?? r.tamanho);
        const addedBy =
          (r.added_by ?? r.adicionado_por) ? String(r.added_by ?? r.adicionado_por) : null;
        const createdAt = String(r.created_at ?? r.criado_em ?? "");
        return {
          id: String(r.id),
          name,
          tags: parseTags(r.tags),
          url: String(r.url),
          size,
          added_by: addedBy,
          created_at: createdAt,
          nome: name,
          tamanho: size,
          adicionado_por: addedBy,
          criado_em: createdAt,
        };
      });
    },

    async addMusicTrack(name, tags, url, size, addedBy) {
      await db
        .prepare(
          `INSERT INTO music_tracks (name, tags, url, size_bytes, added_by)
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
             FROM music_tracks, json_each(music_tracks.tags)
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
