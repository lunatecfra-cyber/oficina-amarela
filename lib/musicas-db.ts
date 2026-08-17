import { sql } from "@/lib/db";

export interface Musica {
  id: string;
  nome: string;
  tags: string[];
  url: string;
  tamanho: number | null;
  adicionado_por: string | null;
  criado_em: string;
}

/** Lista músicas, opcionalmente filtradas por uma tag. */
export async function listarMusicas(tagFiltro?: string): Promise<Musica[]> {
  const rows = tagFiltro
    ? await sql`
        SELECT id, nome, tags, url, tamanho, adicionado_por, criado_em
        FROM musicas
        WHERE ${tagFiltro} = ANY(tags)
        ORDER BY criado_em DESC
      `
    : await sql`
        SELECT id, nome, tags, url, tamanho, adicionado_por, criado_em
        FROM musicas
        ORDER BY criado_em DESC
      `;
  return rows as unknown as Musica[];
}

/** Adiciona uma música à biblioteca. */
export async function adicionarMusica(
  nome: string,
  tags: string[],
  url: string,
  tamanho: number | null,
  adicionadoPor: number
): Promise<void> {
  await sql`
    INSERT INTO musicas (nome, tags, url, tamanho, adicionado_por)
    VALUES (${nome}, ${tags}, ${url}, ${tamanho}, ${adicionadoPor})
  `;
}

/** Retorna todas as tags únicas usadas nas músicas. */
export async function todasAsTags(): Promise<string[]> {
  const rows = await sql`
    SELECT DISTINCT unnest(tags) AS tag
    FROM musicas
    ORDER BY tag
  `;
  return (rows as unknown as { tag: string }[]).map((r) => r.tag);
}
