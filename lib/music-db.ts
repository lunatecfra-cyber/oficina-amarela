import { sql } from "@/lib/db";

export interface MusicTrack {
  id: string;
  name: string;
  tags: string[];
  url: string;
  size: number | null;
  added_by: string | null;
  created_at: string;
}
export type Musica = MusicTrack;

export async function listMusicTracks(filterTag?: string): Promise<MusicTrack[]> {
  const rows = filterTag
    ? await sql`
        SELECT id, name, tags, url, size, added_by, created_at
        FROM music_tracks
        WHERE ${filterTag} = ANY(tags)
        ORDER BY created_at DESC
      `
    : await sql`
        SELECT id, name, tags, url, size, added_by, created_at
        FROM music_tracks
        ORDER BY created_at DESC
      `;
  return rows as unknown as MusicTrack[];
}

export const listarMusicas = listMusicTracks;

export async function addMusicTrack(
  name: string,
  tags: string[],
  url: string,
  size: number | null,
  addedBy: number
): Promise<void> {
  await sql`
    INSERT INTO music_tracks (name, tags, url, size, added_by)
    VALUES (${name}, ${tags}, ${url}, ${size}, ${addedBy})
  `;
}

export const adicionarMusica = addMusicTrack;

export async function getAllMusicTags(): Promise<string[]> {
  const rows = await sql`
    SELECT DISTINCT unnest(tags) AS tag
    FROM music_tracks
    ORDER BY tag
  `;
  return (rows as unknown as { tag: string }[]).map((r) => r.tag);
}

export const allMusicTags = getAllMusicTags;
export const todasAsTags = getAllMusicTags;
