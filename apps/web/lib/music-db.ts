import type { MusicTrack } from "@oficina/db/music";
import { fetchApi, fetchApiJson } from "@/lib/internal-api";

export type { MusicTrack };
export type Musica = MusicTrack;

export async function listMusicTracks(filterTag?: string): Promise<MusicTrack[]> {
  const path = filterTag ? `/tools/music?tag=${encodeURIComponent(filterTag)}` : "/tools/music";
  const list = await fetchApiJson<MusicTrack[]>(path);
  return list ?? [];
}
export const listarMusicas = listMusicTracks;

export async function addMusicTrack(
  name: string,
  tags: string[],
  url: string,
  size: number | null,
  _addedBy: number,
): Promise<void> {
  await fetchApi("/tools/music", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, tags, url, size }),
  });
}
export const adicionarMusica = addMusicTrack;

export async function getAllMusicTags(): Promise<string[]> {
  const list = await fetchApiJson<string[]>("/tools/music/tags");
  return list ?? [];
}
export const allMusicTags = getAllMusicTags;
export const todasAsTags = getAllMusicTags;
