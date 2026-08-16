/**
 * O Panorama do inspetor: o estado do sistema numa tela só.
 *
 * Fica separado de lib/pautas-db.ts porque a pergunta é outra. Lá as
 * consultas são "as missões DESTA pessoa"; aqui são "como está tudo" — sem
 * dono, sem filtro de sessão, e só para quem é admin (a rota checa).
 */
import { sql } from "@/lib/db";

export type Resumo = {
  naFila: number;
  oferecidas: number;
  emEdicao: number;
  emConferencia: number;
  emReedicao: number;
  concluidas: number;
  candidatos: number;
  editores: number;
  editoresLivres: number;
  banidos: number;
};

export type ItemFila = {
  id: number;
  titulo: string;
  formato: string;
  candidato: string;
  criadaEm: string;
  prioridade: number;
  /** 'disponivel' (esperando editor) ou 'oferecida' (já na mão de alguém) */
  status: string;
  /** para quem foi oferecida, quando status = 'oferecida' */
  oferecidaPara: string | null;
  oferecidaEm: string | null;
};

export type MissaoEmVoo = {
  id: number;
  titulo: string;
  status: string;
  candidato: string;
  editor: string | null;
  /** quando entrou no estado atual — reservada_em serve pros três casos */
  desde: string | null;
  temEntrega: boolean;
};

/** Os números do topo. Uma consulta só: são seis contagens da mesma tabela,
 *  e seis viagens ao banco pra mostrar seis números seria desperdício. */
export async function resumoDoSistema(): Promise<Resumo> {
  const [p] = await sql`
    SELECT
      count(*) FILTER (WHERE status = 'disponivel')::int  AS na_fila,
      count(*) FILTER (WHERE status = 'oferecida')::int   AS oferecidas,
      count(*) FILTER (WHERE status = 'reservada')::int   AS em_edicao,
      count(*) FILTER (WHERE status = 'em_revisao')::int  AS em_conferencia,
      count(*) FILTER (WHERE status = 'reedicao')::int    AS em_reedicao,
      count(*) FILTER (WHERE status IN ('aprovada','finalizada'))::int AS concluidas
    FROM pautas
  `;

  const [u] = await sql`
    SELECT
      count(*) FILTER (WHERE papel = 'voz' AND banido = false)::int    AS candidatos,
      count(*) FILTER (WHERE papel = 'editor' AND banido = false)::int AS editores,
      count(*) FILTER (WHERE banido = true)::int                       AS banidos,
      -- "livre" é o editor que não tem missão em mãos nem oferta pendente:
      -- é exatamente quem o despacho consegue chamar agora
      count(*) FILTER (
        WHERE papel = 'editor' AND banido = false AND perfil_completo = true
          AND NOT EXISTS (
            SELECT 1 FROM pautas p
            WHERE p.reservada_por_id = users.id
              AND p.status IN ('reservada','em_revisao','reedicao')
          )
          AND NOT EXISTS (
            SELECT 1 FROM ofertas o WHERE o.editor_id = users.id AND o.status = 'pendente'
          )
      )::int AS editores_livres
    FROM users
  `;

  return {
    naFila: p.na_fila,
    oferecidas: p.oferecidas,
    emEdicao: p.em_edicao,
    emConferencia: p.em_conferencia,
    emReedicao: p.em_reedicao,
    concluidas: p.concluidas,
    candidatos: u.candidatos,
    editores: u.editores,
    editoresLivres: u.editores_livres,
    banidos: u.banidos,
  };
}

/** A fila de edição, na ordem exata em que o despacho vai entregar. */
export async function filaDeEdicao(): Promise<ItemFila[]> {
  const linhas = await sql`
    SELECT p.id, p.titulo, p.formato, p.criada_em, p.prioridade, p.status,
           v.nome AS candidato,
           e.apelido AS oferecida_para,
           o.oferecida_em
    FROM pautas p
    JOIN users v ON v.id = p.porta_voz_id
    LEFT JOIN ofertas o ON o.pauta_id = p.id AND o.status = 'pendente'
    LEFT JOIN users e ON e.id = o.editor_id
    WHERE p.status IN ('disponivel','oferecida')
    ORDER BY p.prioridade DESC, p.criada_em ASC
  `;
  return linhas.map((l) => ({
    id: l.id,
    titulo: l.titulo,
    formato: l.formato,
    candidato: l.candidato,
    criadaEm: new Date(l.criada_em).toISOString(),
    prioridade: l.prioridade,
    status: l.status,
    oferecidaPara: l.oferecida_para ?? null,
    oferecidaEm: l.oferecida_em ? new Date(l.oferecida_em).toISOString() : null,
  }));
}

/** As missões que já saíram da fila e ainda não fecharam — onde cada uma está. */
export async function missoesEmVoo(): Promise<MissaoEmVoo[]> {
  const linhas = await sql`
    SELECT p.id, p.titulo, p.status, p.reservada_em, p.entrega_link,
           v.nome AS candidato, e.apelido AS editor
    FROM pautas p
    JOIN users v ON v.id = p.porta_voz_id
    LEFT JOIN users e ON e.id = p.reservada_por_id
    WHERE p.status IN ('reservada','em_revisao','reedicao')
    ORDER BY
      -- o que está parado há mais tempo aparece primeiro: é o que precisa
      -- de olho, não o que acabou de entrar
      p.reservada_em ASC NULLS LAST
  `;
  return linhas.map((l) => ({
    id: l.id,
    titulo: l.titulo,
    status: l.status,
    candidato: l.candidato,
    editor: l.editor ?? null,
    desde: l.reservada_em ? new Date(l.reservada_em).toISOString() : null,
    temEntrega: Boolean(l.entrega_link),
  }));
}

export type Movimento = "subir" | "descer" | "topo";

/**
 * Muda o lugar de uma missão na fila.
 *
 * Reescreve a prioridade da fila inteira em vez de trocar dois valores. Com
 * troca simples, tudo que nasce em 0 empata, e "subir" dentro de um bloco
 * empatado não mexe em nada — o inspetor clicaria e nada aconteceria. Numerar
 * a lista toda a cada movimento é uma escrita só, e a fila aqui tem dezenas
 * de itens, não milhares.
 */
export async function moverNaFila(
  pautaId: number,
  movimento: Movimento
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const fila = await sql`
    SELECT id FROM pautas
    WHERE status IN ('disponivel','oferecida')
    ORDER BY prioridade DESC, criada_em ASC
  `;
  const ids: number[] = fila.map((l) => l.id);

  const de = ids.indexOf(pautaId);
  if (de === -1) return { ok: false, erro: "Essa missão não está mais na fila." };

  const para =
    movimento === "topo" ? 0 : movimento === "subir" ? de - 1 : de + 1;
  if (para < 0 || para >= ids.length) {
    return { ok: false, erro: "Ela já está nessa ponta da fila." };
  }

  ids.splice(de, 1);
  ids.splice(para, 0, pautaId);

  // primeiro da lista recebe a maior prioridade
  const prioridades = ids.map((_, i) => ids.length - i);

  // arrays vão direto — o postgres.js serializa array de JS como array do
  // Postgres, do mesmo jeito que os `ANY(${ids})` espalhados pelo projeto
  await sql`
    UPDATE pautas SET prioridade = v.prio
    FROM (
      SELECT unnest(${ids}::int[]) AS id,
             unnest(${prioridades}::int[]) AS prio
    ) v
    WHERE pautas.id = v.id
  `;

  return { ok: true };
}
