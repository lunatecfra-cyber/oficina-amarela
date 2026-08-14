// A fila de dispatch: quem recebe qual missão, e quando.
//
// Modelo (estilo Uber motorista): a missão não fica exposta pra todo mundo
// disputar. Ela é OFERECIDA a um editor por vez, com prazo pra responder.
// Recusou ou venceu o prazo -> vai pro próximo da rodada. Passou por todos
// sem ninguém pegar -> fica na lista aberta, onde qualquer um pode reservar
// na mão (é a rede de segurança pra missão órfã).
//
// Por que polling e não LISTEN/NOTIFY: lib/db.ts conecta pelo pooler em modo
// "transaction" (daí o `prepare: false`), que devolve a conexão pro pool
// entre queries e derruba o LISTEN. Somado a isso, função serverless não
// segura conexão viva pra SSE. Então quem move a máquina é o próprio
// polling do editor — cada chamada expira o que venceu e despacha o que está
// parado. Sem cron externo, sem broker.
import { sql } from "@/lib/db";
import type { Pauta } from "@/lib/pautas";

/** Quanto tempo o editor tem pra responder uma oferta. */
export const MINUTOS_OFERTA = 5;

/** Depois disso sem dar sinal, o editor para de receber oferta. */
const MINUTOS_PRESENCA = 3;

export type Oferta = {
  pauta: Pauta;
  expiraEm: string;
  ordem: number;
};

/** O erro do Postgres foi violação de índice único (23505)?
 *  O driver expõe o SQLSTATE em `code`. */
function ehViolacaoDeUnicidade(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "23505"
  );
}

/**
 * Carimba presença. O polling do editor é o batimento cardíaco: sem isso,
 * uma missão ficaria 5 minutos parada esperando resposta de alguém que
 * fechou o navegador.
 */
export async function marcarEditorAtivo(editorId: number): Promise<void> {
  await sql`UPDATE users SET ultimo_visto_em = now() WHERE id = ${editorId}`;
}

/**
 * Fecha as ofertas vencidas e devolve as missões pra fila.
 *
 * Roda em toda leitura da fila em vez de num cron: é um UPDATE barato com
 * índice, e quem está esperando missão é justamente quem está fazendo
 * polling. Se ninguém estiver online, não há oferta pendente pra vencer que
 * importe — a missão volta assim que o primeiro editor aparecer.
 */
export async function expirarOfertasVencidas(): Promise<number> {
  const vencidas = await sql`
    UPDATE ofertas
    SET status = 'expirada', respondida_em = now()
    WHERE status = 'pendente' AND expira_em <= now()
    RETURNING pauta_id
  `;
  if (vencidas.length === 0) return 0;

  // = ANY em vez de IN: o wrapper de lib/db.ts só aceita template literal,
  // não o helper de lista do driver. O array vai como parâmetro mesmo.
  const ids = vencidas.map((v) => v.pauta_id as number);
  await sql`
    UPDATE pautas SET status = 'disponivel'
    WHERE id = ANY(${ids}) AND status = 'oferecida'
  `;
  return vencidas.length;
}

/**
 * Acha o próximo editor da rodada pra uma missão.
 *
 * Ordem: quem já entregou pra este porta-voz primeiro (match), depois quem
 * tem mais entregas, e por último quem está esperando há mais tempo — este
 * desempate é o que impede o mesmo editor de levar tudo.
 *
 * Quem já recebeu esta missão antes (recusou ou deixou vencer) fica de fora:
 * a rodada não volta atrás.
 */
async function proximoEditor(
  pautaId: number,
  portaVozId: number
): Promise<number | null> {
  const [linha] = await sql`
    WITH agora AS (
      -- onde estamos na grade de disponibilidade, no fuso de Brasília.
      -- A grade é [periodo][dia] com dia 0 = segunda, mas EXTRACT(DOW)
      -- devolve 0 = domingo — daí o deslocamento.
      SELECT
        (EXTRACT(DOW FROM now() AT TIME ZONE 'America/Sao_Paulo')::int + 6) % 7 AS dia,
        CASE
          WHEN EXTRACT(HOUR FROM now() AT TIME ZONE 'America/Sao_Paulo') BETWEEN 6 AND 11 THEN 0
          WHEN EXTRACT(HOUR FROM now() AT TIME ZONE 'America/Sao_Paulo') BETWEEN 12 AND 17 THEN 1
          -- madrugada não tem faixa na grade: cai em Noite, porque quem
          -- marcou noite é justamente quem vira a noite
          ELSE 2
        END AS periodo
    )
    SELECT u.id
    FROM users u, agora a
    WHERE u.papel = 'editor'
      AND u.ultimo_visto_em > now() - (${MINUTOS_PRESENCA} || ' minutes')::interval
      AND (u.travado_reservas_ate IS NULL OR u.travado_reservas_ate <= now())
      -- respeita a grade que ele marcou na agenda. Sem grade preenchida
      -- (conta nova) o editor recebe normalmente: a ausência de resposta
      -- não pode ser lida como "indisponível sempre".
      AND (
        u.disponibilidade IS NULL
        OR u.disponibilidade -> a.periodo -> a.dia IS NULL
        OR (u.disponibilidade -> a.periodo ->> a.dia) = 'true'
      )
      -- já tem missão em mãos
      AND NOT EXISTS (
        SELECT 1 FROM pautas p
        WHERE p.reservada_por_id = u.id
          AND p.status IN ('reservada','em_revisao','reedicao')
      )
      -- já tem outra oferta na mão
      AND NOT EXISTS (
        SELECT 1 FROM ofertas o WHERE o.editor_id = u.id AND o.status = 'pendente'
      )
      -- já passou por esta missão nesta rodada
      AND NOT EXISTS (
        SELECT 1 FROM ofertas o WHERE o.editor_id = u.id AND o.pauta_id = ${pautaId}
      )
    ORDER BY
      (SELECT COUNT(*) FROM pautas h
       WHERE h.reservada_por_id = u.id
         AND h.porta_voz_id = ${portaVozId}
         AND h.status IN ('aprovada','finalizada')) DESC,
      u.entregues DESC,
      u.ultimo_visto_em ASC
    LIMIT 1
  `;
  return linha?.id ?? null;
}

/**
 * Distribui as missões paradas. Mais antiga primeiro.
 *
 * Duas chamadas simultâneas não conseguem oferecer a mesma missão pra dois
 * editores: os índices únicos parciais de `ofertas` (um pendente por pauta,
 * um pendente por editor) fazem a segunda falhar. O erro é engolido de
 * propósito — significa que outra requisição chegou antes, que é exatamente
 * o resultado desejado.
 */
export async function despacharMissoes(): Promise<number> {
  const paradas = await sql`
    SELECT id, porta_voz_id FROM pautas
    WHERE status = 'disponivel'
    ORDER BY criada_em ASC
    LIMIT 20
  `;

  let despachadas = 0;
  for (const p of paradas) {
    const editorId = await proximoEditor(p.id, p.porta_voz_id);
    if (!editorId) continue; // ninguém elegível agora: fica na lista aberta

    try {
      const [{ ordem }] = await sql`
        SELECT COALESCE(MAX(ordem), 0) + 1 AS ordem FROM ofertas WHERE pauta_id = ${p.id}
      `;

      await sql`
        INSERT INTO ofertas (pauta_id, editor_id, expira_em, ordem)
        VALUES (${p.id}, ${editorId},
                now() + (${MINUTOS_OFERTA} || ' minutes')::interval,
                ${ordem})
      `;

      // só sai da lista aberta se a oferta foi mesmo criada
      await sql`
        UPDATE pautas SET status = 'oferecida'
        WHERE id = ${p.id} AND status = 'disponivel'
      `;
      despachadas++;
    } catch (e) {
      // 23505 = unique_violation: outra requisição despachou esta missão
      // primeiro. É o resultado esperado da corrida, então segue em frente.
      //
      // Qualquer outro erro (conexão caída, timeout, SQL quebrado) é
      // relançado. Antes este catch era vazio e engolia TUDO: uma falha real
      // do dispatch em produção sumia sem deixar rastro.
      if (!ehViolacaoDeUnicidade(e)) throw e;
    }
  }
  return despachadas;
}

/** A oferta que este editor tem na mão agora, se houver. */
export async function ofertaPendente(editorId: number): Promise<Oferta | null> {
  const [l] = await sql`
    SELECT o.expira_em, o.ordem,
           p.id, p.titulo, p.formato, p.drive_link, p.status,
           p.brief_tom, p.brief_cor, p.brief_fonte, p.brief_refs,
           p.extras, p.motivo, p.prazo_desejado, p.criada_em,
           u.nome AS porta_voz_nome, u.apelido AS porta_voz_apelido
    FROM ofertas o
    JOIN pautas p ON p.id = o.pauta_id
    JOIN users u ON u.id = p.porta_voz_id
    WHERE o.editor_id = ${editorId} AND o.status = 'pendente' AND o.expira_em > now()
    LIMIT 1
  `;
  if (!l) return null;

  return {
    expiraEm: new Date(l.expira_em).toISOString(),
    ordem: l.ordem,
    pauta: {
      id: `db-${l.id}`,
      portaVoz: l.porta_voz_nome,
      portaVozApelido: l.porta_voz_apelido,
      titulo: l.titulo,
      formato: l.formato,
      brief: {
        tom: l.brief_tom ?? undefined,
        cor: l.brief_cor ?? undefined,
        fonte: l.brief_fonte ?? undefined,
        refs: l.brief_refs ?? undefined,
      },
      status: l.status,
      criadaEm: new Date(l.criada_em).toISOString(),
      driveLink: l.drive_link ?? undefined,
      extras: l.extras ?? undefined,
      motivo: l.motivo ?? undefined,
      prazoDesejado: l.prazo_desejado
        ? new Date(l.prazo_desejado).toISOString().slice(0, 10)
        : undefined,
    },
  };
}

/** Editor aceita: a missão vira dele — sem prazo, é dele até entregar/devolver. */
export async function aceitarOferta(
  pautaId: number,
  editorId: number
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const fechada = await sql`
    UPDATE ofertas SET status = 'aceita', respondida_em = now()
    WHERE pauta_id = ${pautaId} AND editor_id = ${editorId}
      AND status = 'pendente' AND expira_em > now()
    RETURNING id
  `;
  if (fechada.length === 0) {
    return { ok: false, erro: "Essa oferta não está mais valendo." };
  }

  await sql`
    UPDATE pautas
    SET status = 'reservada',
        reservada_por_id = ${editorId},
        reservada_em = now()
    WHERE id = ${pautaId} AND status = 'oferecida'
  `;
  return { ok: true };
}

/** Editor recusa: volta pra fila e a rodada segue pro próximo. */
export async function recusarOferta(
  pautaId: number,
  editorId: number
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const fechada = await sql`
    UPDATE ofertas SET status = 'rejeitada', respondida_em = now()
    WHERE pauta_id = ${pautaId} AND editor_id = ${editorId} AND status = 'pendente'
    RETURNING id
  `;
  if (fechada.length === 0) {
    return { ok: false, erro: "Essa oferta não está mais valendo." };
  }

  await sql`
    UPDATE pautas SET status = 'disponivel'
    WHERE id = ${pautaId} AND status = 'oferecida'
  `;
  return { ok: true };
}

/** Quantos editores estão online agora — o porta-voz vê isso ao criar. */
export async function editoresOnline(): Promise<number> {
  const [l] = await sql`
    SELECT COUNT(*)::int AS total FROM users
    WHERE papel = 'editor'
      AND ultimo_visto_em > now() - (${MINUTOS_PRESENCA} || ' minutes')::interval
  `;
  return l?.total ?? 0;
}
