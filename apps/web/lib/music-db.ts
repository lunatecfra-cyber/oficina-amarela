import { sql } from "@/lib/db";

export interface MusicTrack {
  id: string;
  name: string;
  tags: string[];
  url: string;
  size: number | null;
  added_by: string | null;
  created_at: string;
  // aliases
  nome?: string;
  tamanho?: number | null;
  adicionado_por?: string | null;
  criado_em?: string;
}
export type Musica = MusicTrack;

type LinhaMusica = {
  id: string;
  nome: string;
  tags: string[];
  url: string;
  tamanho: number | null;
  adicionado_por: string | null;
  criado_em: string;
};

export async function listMusicTracks(filterTag?: string): Promise<MusicTrack[]> {
  const rows = filterTag
    ? await sql`
        SELECT id, nome, tags, url, tamanho, adicionado_por, criado_em
        FROM musicas
        WHERE ${filterTag} = ANY(tags)
        ORDER BY criado_em DESC
      `
    : await sql`
        SELECT id, nome, tags, url, tamanho, adicionado_por, criado_em
        FROM musicas
        ORDER BY criado_em DESC
      `;
  return (rows as unknown as LinhaMusica[]).map((r) => ({
    id: r.id,
    name: r.nome,
    tags: r.tags,
    url: r.url,
    size: r.tamanho,
    added_by: r.adicionado_por,
    created_at: r.criado_em,
    nome: r.nome,
    tamanho: r.tamanho,
    adicionado_por: r.adicionado_por,
    criado_em: r.criado_em,
  }));
}

export const listarMusicas = listMusicTracks;

export async function addMusicTrack(
  name: string,
  tags: string[],
  url: string,
  size: number | null,
  addedBy: number,
): Promise<void> {
  await sql`
    INSERT INTO musicas (nome, tags, url, tamanho, adicionado_por)
    VALUES (${name}, ${tags}, ${url}, ${size}, ${addedBy})
  `;
}

export const adicionarMusica = addMusicTrack;

export async function getAllMusicTags(): Promise<string[]> {
  const rows = await sql`
    SELECT DISTINCT unnest(tags) AS tag
    FROM musicas
    ORDER BY tag
  `;
  return (rows as unknown as { tag: string }[]).map((r) => r.tag);
}

export const allMusicTags = getAllMusicTags;
export const todasAsTags = getAllMusicTags;
