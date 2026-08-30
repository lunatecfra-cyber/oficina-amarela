import { sql } from "./client.ts";

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

export type MusicRepository = {
  listMusicTracks(filterTag?: string): Promise<MusicTrack[]>;
  addMusicTrack(
    name: string,
    tags: string[],
    url: string,
    size: number | null,
    addedBy: number,
  ): Promise<void>;
  getAllMusicTags(): Promise<string[]>;
};

export const postgresMusic: MusicRepository = {
  async listMusicTracks(filterTag?: string): Promise<MusicTrack[]> {
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
      id: String(r.id),
      name: String(r.nome),
      tags: Array.isArray(r.tags) ? r.tags : [],
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
    await sql`
      INSERT INTO musicas (nome, tags, url, tamanho, adicionado_por)
      VALUES (${name}, ${tags}, ${url}, ${size}, ${addedBy})
    `;
  },

  async getAllMusicTags(): Promise<string[]> {
    const rows = await sql`
      SELECT DISTINCT unnest(tags) AS tag
      FROM musicas
      ORDER BY tag
    `;
    return (rows as unknown as { tag: string }[]).map((r) => String(r.tag));
  },
};
