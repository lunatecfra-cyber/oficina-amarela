import type { Mission } from "@oficina/domain/missions";
import {
  ACTIVE_MISSION_PER_EDITOR_INDEX,
  isUniqueViolation,
  OFFER_UNIQUE_INDEXES,
  sql,
} from "./client.ts";
import { type MissionOfferRow, pendingOfferFromRow } from "./mission-offer.ts";

/**
 * Fila de missões: as operações que carregam invariante.
 *
 * O contrato é desenhado por atomicidade de negócio, não por tabela. Cada
 * método corresponde a uma transição que precisa acontecer inteira ou não
 * acontecer — decompor qualquer um deles em "busca" + "escreve" no chamador
 * traz de volta as corridas que P0-01, P0-02 e P0-03 fecharam.
 *
 * As invariantes vivem em índice único no banco (ver supabase/README.md), não
 * em checagem de código. A implementação traduz a violação de unicidade em
 * motivo tipado; a mensagem em PT-BR mora na borda HTTP, não aqui.
 */

export const OFFER_MINUTES = 5;

const PRESENCE_MINUTES = 3;

// A janela de presença é de 3 minutos; gravar a cada poll (15s) é 4x mais
// escrita do que a decisão precisa. 60s mantém a granularidade útil e corta as
// escritas mais caras do caminho quente.
const PRESENCE_WRITE_SECONDS = 60;

/** Motivo de recusa. Sem texto de usuário: quem traduz é a borda HTTP. */
export type MissionQueueFailure =
  | "already_holds_mission"
  | "mission_unavailable"
  | "mission_not_held"
  | "offer_invalid";

export type QueueResult = { ok: true } | { ok: false; reason: MissionQueueFailure };

export type PendingOffer = {
  mission: Mission;
  expiresAt: string;
  orderIndex: number;
};

export interface MissionQueueRepository {
  /** Reserva direta, fora do fluxo de oferta. */
  reserveMission(missionId: number, editorId: number): Promise<QueueResult>;
  /** Devolve a missão para a fila. */
  abandonMission(missionId: number, editorId: number): Promise<QueueResult>;
  /** Aceita a oferta viva do editor. `ok: true` significa que ele ficou com a missão. */
  acceptOffer(missionId: number, editorId: number): Promise<QueueResult>;
  /** Recusa a oferta e devolve a missão para a fila, no mesmo comando. */
  rejectOffer(missionId: number, editorId: number): Promise<QueueResult>;
  /** Oferece missões disponíveis a editores elegíveis. Devolve quantas saíram. */
  dispatchOffers(): Promise<number>;
  /** Expira ofertas vencidas ou de editores ausentes. Devolve quantas caíram. */
  expireOffers(): Promise<number>;
  /** Oferta pendente do editor, já projetada para a UI. */
  pendingOfferFor(editorId: number): Promise<PendingOffer | null>;
  /** Renova a presença do editor, respeitando a janela de escrita. */
  markEditorActive(editorId: number): Promise<void>;
}

const failure = (reason: MissionQueueFailure): QueueResult => ({ ok: false, reason });

function isOfferUniqueViolation(error: unknown): boolean {
  return OFFER_UNIQUE_INDEXES.some((index) => isUniqueViolation(error, index));
}

async function nextEligibleEditor(
  missionId: number,
  spokespersonId: number,
): Promise<number | null> {
  const [row] = await sql`
    WITH agora AS (
      SELECT
        (EXTRACT(DOW FROM now() AT TIME ZONE 'America/Sao_Paulo')::int + 6) % 7 AS dia,
        CASE
          WHEN EXTRACT(HOUR FROM now() AT TIME ZONE 'America/Sao_Paulo') BETWEEN 6 AND 11 THEN 0
          WHEN EXTRACT(HOUR FROM now() AT TIME ZONE 'America/Sao_Paulo') BETWEEN 12 AND 17 THEN 1
          ELSE 2
        END AS periodo
    )
    SELECT u.id
    FROM users u, agora a
    WHERE u.papel = 'editor'
      AND u.ultimo_visto_em > now() - (${PRESENCE_MINUTES} || ' minutes')::interval
      AND (u.travado_reservas_ate IS NULL OR u.travado_reservas_ate <= now())
      AND (
        u.disponibilidade IS NULL
        OR u.disponibilidade -> a.periodo -> a.dia IS NULL
        OR (u.disponibilidade -> a.periodo ->> a.dia) = 'true'
      )
      AND NOT EXISTS (
        SELECT 1 FROM pautas p
        WHERE p.reservada_por_id = u.id
          AND p.status IN ('reservada','em_revisao','reedicao')
      )
      AND NOT EXISTS (
        SELECT 1 FROM ofertas o WHERE o.editor_id = u.id AND o.status = 'pendente'
      )
      AND NOT EXISTS (
        SELECT 1 FROM ofertas o WHERE o.editor_id = u.id AND o.pauta_id = ${missionId}
      )
    ORDER BY
      (SELECT COUNT(*) FROM pautas h
       WHERE h.reservada_por_id = u.id
         AND h.porta_voz_id = ${spokespersonId}
         AND h.status IN ('aprovada','finalizada')) DESC,
      u.entregues DESC,
      u.ultimo_visto_em ASC
    LIMIT 1
  `;
  return (row?.id as number | undefined) ?? null;
}

export const postgresMissionQueue: MissionQueueRepository = {
  async reserveMission(missionId, editorId) {
    // Checagem antecipada: só melhora a mensagem no caso comum. Quem garante a
    // regra é idx_pautas_missao_ativa_por_editor — duas reservas simultâneas do
    // mesmo editor passariam por aqui juntas.
    const [active] = await sql`
      SELECT id FROM pautas
      WHERE reservada_por_id = ${editorId} AND status IN ('reservada', 'em_revisao', 'reedicao')
    `;
    if (active) return failure("already_holds_mission");

    try {
      const [row] = await sql`
        UPDATE pautas
        SET status = 'reservada', reservada_por_id = ${editorId}, reservada_em = now()
        WHERE id = ${missionId} AND status = 'disponivel'
        RETURNING id
      `;
      if (!row) return failure("mission_unavailable");
      return { ok: true };
    } catch (error) {
      if (isUniqueViolation(error, ACTIVE_MISSION_PER_EDITOR_INDEX)) {
        return failure("already_holds_mission");
      }
      throw error;
    }
  },

  async abandonMission(missionId, editorId) {
    const rows = await sql`
      UPDATE pautas
      SET status = 'disponivel', reservada_por_id = NULL, reservada_ate = NULL, reservada_em = NULL
      WHERE id = ${missionId} AND reservada_por_id = ${editorId}
        AND status IN ('reservada', 'reedicao')
      RETURNING id
    `;
    if (rows.length === 0) return failure("mission_not_held");
    return { ok: true };
  },

  async acceptOffer(missionId, editorId) {
    // A reserva vem primeiro, condicionada a existir oferta viva: assim
    // `ok: true` só sai quando o editor realmente ficou com a missão. Na ordem
    // inversa, a oferta era consumida mesmo quando a missão já tinha voltado.
    let reserved: readonly unknown[];
    try {
      reserved = await sql`
        UPDATE pautas AS p
        SET status = 'reservada',
            reservada_por_id = ${editorId},
            reservada_em = now()
        WHERE p.id = ${missionId}
          AND p.status = 'oferecida'
          AND EXISTS (
            SELECT 1 FROM ofertas o
            WHERE o.pauta_id = p.id AND o.editor_id = ${editorId}
              AND o.status = 'pendente' AND o.expira_em > now()
          )
        RETURNING p.id
      `;
    } catch (error) {
      if (isUniqueViolation(error, ACTIVE_MISSION_PER_EDITOR_INDEX)) {
        return failure("already_holds_mission");
      }
      throw error;
    }

    if (reserved.length === 0) return failure("offer_invalid");

    // Se cair aqui, a missão já é do editor. A oferta pendente que sobrar expira
    // sozinha em OFFER_MINUTES e não devolve a missão para a fila (o sweep só
    // mexe em status 'oferecida').
    await sql`
      UPDATE ofertas SET status = 'aceita', respondida_em = now()
      WHERE pauta_id = ${missionId} AND editor_id = ${editorId} AND status = 'pendente'
    `;

    return { ok: true };
  },

  async rejectOffer(missionId, editorId) {
    // Recusar e devolver a missão para a fila no mesmo comando: separados, uma
    // falha entre eles deixava a missão presa em 'oferecida' sem oferta
    // pendente, e o sweep de expiração não a resgatava.
    const declined = await sql`
      WITH declined AS (
        UPDATE ofertas SET status = 'rejeitada', respondida_em = now()
        WHERE pauta_id = ${missionId} AND editor_id = ${editorId} AND status = 'pendente'
        RETURNING pauta_id
      ), released AS (
        UPDATE pautas SET status = 'disponivel'
        WHERE id IN (SELECT pauta_id FROM declined) AND status = 'oferecida'
        RETURNING id
      )
      SELECT pauta_id FROM declined
    `;
    if (declined.length === 0) return failure("offer_invalid");
    return { ok: true };
  },

  async dispatchOffers() {
    const pending = await sql`
      SELECT id, porta_voz_id FROM pautas
      WHERE status = 'disponivel'
      ORDER BY prioridade DESC, criada_em ASC
      LIMIT 20
    `;

    let dispatched = 0;
    for (const mission of pending) {
      const editorId = await nextEligibleEditor(mission.id, mission.porta_voz_id);
      if (!editorId) continue;

      try {
        // Um único comando: ou a missão sai de 'disponivel' E a oferta nasce, ou
        // nada acontece.
        const created = await sql`
          WITH claimed AS (
            UPDATE pautas SET status = 'oferecida'
            WHERE id = ${mission.id} AND status = 'disponivel'
            RETURNING id
          )
          INSERT INTO ofertas (pauta_id, editor_id, expira_em, ordem)
          SELECT c.id, ${editorId},
                 now() + (${OFFER_MINUTES} || ' minutes')::interval,
                 (SELECT COALESCE(MAX(o.ordem), 0) + 1 FROM ofertas o WHERE o.pauta_id = c.id)
          FROM claimed c
          RETURNING id
        `;
        if (created.length > 0) dispatched++;
      } catch (error) {
        // Alguma invariante de oferta barrou o par (missão, editor). O comando
        // inteiro reverte, então a missão continua 'disponivel' pro próximo.
        if (!isOfferUniqueViolation(error)) throw error;
      }
    }
    return dispatched;
  },

  async expireOffers() {
    const expired = await sql`
      UPDATE ofertas o
      SET status = 'expirada', respondida_em = now()
      FROM users u
      WHERE o.status = 'pendente'
        AND (
          o.oferecida_em <= now() - (${OFFER_MINUTES} || ' minutes')::interval
          OR
          (o.editor_id = u.id AND u.ultimo_visto_em <= now() - interval '3 minutes')
        )
      RETURNING o.pauta_id
    `;
    if (expired.length === 0) return 0;

    const ids = expired.map((row) => row.pauta_id as number);
    await sql`
      UPDATE pautas SET status = 'disponivel'
      WHERE id = ANY(${ids}) AND status = 'oferecida'
    `;
    return expired.length;
  },

  async pendingOfferFor(editorId) {
    const [row] = await sql`
      SELECT o.expira_em, o.ordem,
             p.id, p.titulo, p.formato, p.drive_link, p.youtube_link, p.status,
             p.brief_tom, p.brief_cor, p.brief_fonte, p.brief_refs,
             p.extras, p.motivo, p.prazo_desejado, p.criada_em,
             u.nome AS porta_voz_nome, u.apelido AS porta_voz_apelido
      FROM ofertas o
      JOIN pautas p ON p.id = o.pauta_id
      JOIN users u ON u.id = p.porta_voz_id
      WHERE o.editor_id = ${editorId} AND o.status = 'pendente' AND o.expira_em > now()
      LIMIT 1
    `;
    return row ? pendingOfferFromRow(row as unknown as MissionOfferRow) : null;
  },

  async markEditorActive(editorId) {
    await sql`
      UPDATE users SET ultimo_visto_em = now()
      WHERE id = ${editorId}
        AND (
          ultimo_visto_em IS NULL
          OR ultimo_visto_em < now() - make_interval(secs => ${PRESENCE_WRITE_SECONDS})
        )
    `;
  },
};
