// As novidades da página de entrada, no banco.
//
// Começaram num arquivo, e o arquivo tinha um problema: publicar uma novidade
// exigia editar código e subir deploy. Quem escreve as novidades é o dono do
// produto, não quem mexe no código — então elas moram no banco e se escrevem
// pela tela do inspetor.
//
// O arquivo lib/novidades.ts continua existindo como texto inicial: enquanto
// ninguém tiver publicado nada, a página mostra aquelas em vez de uma seção
// vazia. Assim que a primeira novidade real entrar, o banco manda.
import { sql } from "@/lib/db";
import { LIMITES, limitar } from "@/lib/limites";

export type NovidadeDb = {
  id: number;
  titulo: string;
  texto: string;
  publicada: boolean;
  criadaEm: string;
  autor: string | null;
};

type Linha = {
  id: number;
  titulo: string;
  texto: string;
  publicada: boolean;
  criada_em: string;
  autor: string | null;
};

const paraNovidade = (l: Linha): NovidadeDb => ({
  id: l.id,
  titulo: l.titulo,
  texto: l.texto,
  publicada: l.publicada,
  criadaEm: new Date(l.criada_em).toISOString(),
  autor: l.autor,
});

/** O que a página de entrada mostra: só publicadas, mais novas primeiro. */
export async function novidadesPublicadas(limite = 4): Promise<NovidadeDb[]> {
  const linhas = await sql`
    SELECT n.id, n.titulo, n.texto, n.publicada, n.criada_em, u.apelido AS autor
    FROM novidades n
    LEFT JOIN users u ON u.id = n.autor_id
    WHERE n.publicada = true
    ORDER BY n.criada_em DESC
    LIMIT ${limite}
  `;
  return (linhas as unknown as Linha[]).map(paraNovidade);
}

/** Tudo, inclusive rascunho — é o que o inspetor administra. */
export async function todasNovidades(): Promise<NovidadeDb[]> {
  const linhas = await sql`
    SELECT n.id, n.titulo, n.texto, n.publicada, n.criada_em, u.apelido AS autor
    FROM novidades n
    LEFT JOIN users u ON u.id = n.autor_id
    ORDER BY n.criada_em DESC
  `;
  return (linhas as unknown as Linha[]).map(paraNovidade);
}

export async function criarNovidade(
  autorId: number,
  titulo: string,
  texto: string,
  publicada = true
): Promise<{ ok: true; id: number } | { ok: false; erro: string }> {
  // mesmo teto do resto do sistema: cortar no ponto que grava, não confiar no
  // maxLength do formulário, que some no primeiro curl
  const t = limitar(titulo, LIMITES.titulo);
  const c = limitar(texto, LIMITES.textoLongo);
  if (!t) return { ok: false, erro: "Escreva um título." };
  if (!c) return { ok: false, erro: "Escreva o texto da novidade." };

  const [linha] = await sql`
    INSERT INTO novidades (titulo, texto, autor_id, publicada)
    VALUES (${t}, ${c}, ${autorId}, ${publicada})
    RETURNING id
  `;
  return { ok: true, id: linha.id };
}

/** Tira do ar sem apagar — dá pra voltar atrás. */
export async function alternarPublicacao(
  id: number
): Promise<{ ok: true; publicada: boolean } | { ok: false; erro: string }> {
  const [linha] = await sql`
    UPDATE novidades SET publicada = NOT publicada WHERE id = ${id}
    RETURNING publicada
  `;
  if (!linha) return { ok: false, erro: "Novidade não encontrada." };
  return { ok: true, publicada: linha.publicada };
}

export async function apagarNovidade(id: number): Promise<{ ok: true } | { ok: false; erro: string }> {
  const linhas = await sql`DELETE FROM novidades WHERE id = ${id} RETURNING id`;
  if (linhas.length === 0) return { ok: false, erro: "Novidade não encontrada." };
  return { ok: true };
}
