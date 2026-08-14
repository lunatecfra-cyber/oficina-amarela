// Chat por missão — mensagens entre candidato, editor e inspetor.
//
// Fica em lib própria (e não em pautas-db.ts) porque é uma superfície nova
// com regra de acesso própria. A conversa é PRESA à missão: participantes
// são o dono da pauta, o editor que a reservou (enquanto for dele) e o
// inspetor — que lê tudo e pode escrever (controle máximo).
import { sql } from "@/lib/db";
import { LIMITES, limitar } from "@/lib/limites";
import type { SessaoUsuario } from "@/lib/sessao";

export type Mensagem = {
  id: string; // "m-123" — prefixo pra chave de lista, como as pautas
  pautaId: number;
  autorId: number;
  autorNome: string;
  autorPapel: "voz" | "editor" | "admin";
  texto: string;
  criadaEm: string;
};

type LinhaMensagem = {
  id: number;
  pauta_id: number;
  autor_id: number;
  nome: string;
  papel: string;
  texto: string;
  criada_em: string;
};

function paraMensagem(l: LinhaMensagem): Mensagem {
  return {
    id: `m-${l.id}`,
    pautaId: l.pauta_id,
    autorId: l.autor_id,
    autorNome: l.nome,
    autorPapel: l.papel as Mensagem["autorPapel"],
    texto: l.texto,
    criadaEm: l.criada_em,
  };
}

const SELECT_BASE = sql`
  SELECT m.id, m.pauta_id, m.autor_id, u.nome, u.papel, m.texto, m.criada_em
  FROM mensagens m
  JOIN users u ON u.id = m.autor_id
`;

/** A thread de uma missão, em ordem cronológica. */
export async function mensagensDaPauta(pautaId: number): Promise<Mensagem[]> {
  const linhas = await sql`${SELECT_BASE}
    WHERE m.pauta_id = ${pautaId}
    ORDER BY m.criada_em ASC
    LIMIT 200
  `;
  return (linhas as unknown as LinhaMensagem[]).map(paraMensagem);
}

/**
 * Leitura em lote pros cards do inspetor — uma query só, não uma por missão.
 * Devolve um mapa por pautaId.
 */
export async function mensagensDePautas(pautaIds: number[]): Promise<Map<number, Mensagem[]>> {
  if (pautaIds.length === 0) return new Map();
  const linhas = await sql`${SELECT_BASE}
    WHERE m.pauta_id = ANY(${pautaIds})
    ORDER BY m.criada_em ASC
  `;
  const mapa = new Map<number, Mensagem[]>();
  for (const l of linhas as unknown as LinhaMensagem[]) {
    const m = paraMensagem(l);
    const lista = mapa.get(m.pautaId) ?? [];
    lista.push(m);
    mapa.set(m.pautaId, lista);
  }
  return mapa;
}

/**
 * Regra de acesso do chat, num lugar só: dono da missão, editor que a tem
 * em mãos, ou inspetor. Papel sozinho não basta — o WHERE confere VÍNCULO
 * com esta pauta (mesma defesa em profundidade do resto do projeto).
 */
export async function enviarMensagem(
  pautaId: number,
  sessao: SessaoUsuario,
  textoBruto: string
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const texto = limitar(textoBruto, LIMITES.mensagem);
  if (!texto) return { ok: false, erro: "Escreva alguma coisa antes de enviar." };

  const [pauta] = await sql`
    SELECT porta_voz_id, reservada_por_id FROM pautas WHERE id = ${pautaId}
  `;
  if (!pauta) return { ok: false, erro: "Missão não encontrada." };

  const ehDono = pauta.porta_voz_id === sessao.id;
  const ehEditorDaMissao = pauta.reservada_por_id === sessao.id;
  if (!ehDono && !ehEditorDaMissao && sessao.papel !== "admin") {
    return { ok: false, erro: "Só quem participa da missão conversa nela." };
  }

  await sql`
    INSERT INTO mensagens (pauta_id, autor_id, texto)
    VALUES (${pautaId}, ${sessao.id}, ${texto})
  `;
  return { ok: true };
}
