import { type MissionOfferRow, pendingOfferFromRow } from "../mission-offer.ts";
import type { MissionQueueFailure, MissionQueueRepository, QueueResult } from "../mission-queue.ts";
import type { D1DatabaseLike } from "./types.ts";

const OFFER_MINUTES = 5;
const PRESENCE_MINUTES = 3;
const PRESENCE_WRITE_SECONDS = 60;

const failure = (reason: MissionQueueFailure): QueueResult => ({ ok: false, reason });

function errorIncludes(error: unknown, fragment: string): boolean {
  return error instanceof Error && error.message.includes(fragment);
}

function isActiveMissionConflict(error: unknown): boolean {
  return errorIncludes(error, "UNIQUE constraint failed: pautas.reservada_por_id");
}

function isOfferConflict(error: unknown): boolean {
  return (
    errorIncludes(error, "UNIQUE constraint failed: ofertas.") ||
    errorIncludes(error, "mission_unavailable")
  );
}

const saoPauloClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  hour: "2-digit",
  hourCycle: "h23",
});

function availabilitySlot(now: Date): { day: number; period: number } {
  const parts = Object.fromEntries(
    saoPauloClock.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday);
  const hour = Number(parts.hour);
  return { day, period: hour >= 6 && hour <= 11 ? 0 : hour >= 12 && hour <= 17 ? 1 : 2 };
}

async function nextEligibleEditor(
  db: D1DatabaseLike,
  missionId: number,
  spokespersonId: number,
  now: Date,
): Promise<number | null> {
  const { day, period } = availabilitySlot(now);
  const availabilityPath = `$[${period}][${day}]`;
  const nowIso = now.toISOString();
  const presenceCutoff = new Date(now.getTime() - PRESENCE_MINUTES * 60_000).toISOString();
  const row = await db
    .prepare(
      `SELECT u.id
       FROM users u
       WHERE u.papel = 'editor'
         AND u.ultimo_visto_em > ?
         AND (u.travado_reservas_ate IS NULL OR u.travado_reservas_ate <= ?)
         AND (
           u.disponibilidade IS NULL
           OR json_extract(u.disponibilidade, ?) IS NULL
           OR json_extract(u.disponibilidade, ?) = 1
         )
         AND NOT EXISTS (
           SELECT 1 FROM pautas p
           WHERE p.reservada_por_id = u.id
             AND p.status IN ('reservada', 'em_revisao', 'reedicao')
         )
         AND NOT EXISTS (
           SELECT 1 FROM ofertas o WHERE o.editor_id = u.id AND o.status = 'pendente'
         )
         AND NOT EXISTS (
           SELECT 1 FROM ofertas o WHERE o.editor_id = u.id AND o.pauta_id = ?
         )
       ORDER BY
         (SELECT COUNT(*) FROM pautas h
          WHERE h.reservada_por_id = u.id
            AND h.porta_voz_id = ?
            AND h.status IN ('aprovada', 'finalizada')) DESC,
         u.entregues DESC,
         u.ultimo_visto_em ASC
       LIMIT 1`,
    )
    .bind(presenceCutoff, nowIso, availabilityPath, availabilityPath, missionId, spokespersonId)
    .first<{ id: number }>();
  return row?.id ?? null;
}

export function createD1MissionQueue(
  db: D1DatabaseLike,
  clock: () => Date = () => new Date(),
): MissionQueueRepository {
  return {
    async reserveMission(missionId, editorId) {
      const active = await db
        .prepare(
          `SELECT id FROM pautas
           WHERE reservada_por_id = ? AND status IN ('reservada', 'em_revisao', 'reedicao')`,
        )
        .bind(editorId)
        .first();
      if (active) return failure("already_holds_mission");

      try {
        const result = await db
          .prepare(
            `UPDATE pautas
             SET status = 'reservada', reservada_por_id = ?, reservada_em = ?
             WHERE id = ? AND status = 'disponivel'`,
          )
          .bind(editorId, clock().toISOString(), missionId)
          .run();
        return result.meta.changes > 0 ? { ok: true } : failure("mission_unavailable");
      } catch (error) {
        if (isActiveMissionConflict(error)) return failure("already_holds_mission");
        throw error;
      }
    },

    async abandonMission(missionId, editorId) {
      const result = await db
        .prepare(
          `UPDATE pautas
           SET status = 'disponivel', reservada_por_id = NULL,
               reservada_ate = NULL, reservada_em = NULL
           WHERE id = ? AND reservada_por_id = ? AND status IN ('reservada', 'reedicao')`,
        )
        .bind(missionId, editorId)
        .run();
      return result.meta.changes > 0 ? { ok: true } : failure("mission_not_held");
    },

    async acceptOffer(missionId, editorId) {
      try {
        const nowIso = clock().toISOString();
        const result = await db
          .prepare(
            `UPDATE ofertas
             SET status = 'aceita', respondida_em = ?
             WHERE pauta_id = ? AND editor_id = ?
               AND status = 'pendente' AND expira_em > ?`,
          )
          .bind(nowIso, missionId, editorId, nowIso)
          .run();
        return result.meta.changes > 0 ? { ok: true } : failure("offer_invalid");
      } catch (error) {
        if (isActiveMissionConflict(error)) return failure("already_holds_mission");
        if (errorIncludes(error, "offer_invalid")) return failure("offer_invalid");
        throw error;
      }
    },

    async rejectOffer(missionId, editorId) {
      const result = await db
        .prepare(
          `UPDATE ofertas
           SET status = 'rejeitada', respondida_em = ?
           WHERE pauta_id = ? AND editor_id = ? AND status = 'pendente'`,
        )
        .bind(clock().toISOString(), missionId, editorId)
        .run();
      return result.meta.changes > 0 ? { ok: true } : failure("offer_invalid");
    },

    async dispatchOffers() {
      const { results: missions } = await db
        .prepare(
          `SELECT id, porta_voz_id FROM pautas
           WHERE status = 'disponivel'
           ORDER BY prioridade DESC, criada_em ASC
           LIMIT 20`,
        )
        .all<{ id: number; porta_voz_id: number }>();

      let dispatched = 0;
      for (const mission of missions) {
        const now = clock();
        const editorId = await nextEligibleEditor(db, mission.id, mission.porta_voz_id, now);
        if (!editorId) continue;

        try {
          const offeredAt = now.toISOString();
          const expiresAt = new Date(now.getTime() + OFFER_MINUTES * 60_000).toISOString();
          const result = await db
            .prepare(
              `INSERT INTO ofertas
                 (pauta_id, editor_id, status, oferecida_em, expira_em, ordem)
               VALUES
                 (?, ?, 'pendente', ?, ?,
                  (SELECT COALESCE(MAX(ordem), 0) + 1 FROM ofertas WHERE pauta_id = ?))`,
            )
            .bind(mission.id, editorId, offeredAt, expiresAt, mission.id)
            .run();
          if (result.meta.changes > 0) dispatched++;
        } catch (error) {
          if (!isOfferConflict(error)) throw error;
        }
      }
      return dispatched;
    },

    async expireOffers() {
      const now = clock();
      const { results } = await db
        .prepare(
          `UPDATE ofertas
           SET status = 'expirada', respondida_em = ?
           WHERE status = 'pendente'
             AND (
               oferecida_em <= ?
               OR EXISTS (
                 SELECT 1 FROM users u
                 WHERE u.id = ofertas.editor_id AND u.ultimo_visto_em <= ?
               )
             )
           RETURNING pauta_id`,
        )
        .bind(
          now.toISOString(),
          new Date(now.getTime() - OFFER_MINUTES * 60_000).toISOString(),
          new Date(now.getTime() - PRESENCE_MINUTES * 60_000).toISOString(),
        )
        .all<{ pauta_id: number }>();
      return results.length;
    },

    async pendingOfferFor(editorId) {
      const row = await db
        .prepare(
          `SELECT o.expira_em, o.ordem,
                  p.id, p.titulo, p.formato, p.drive_link, p.youtube_link, p.status,
                  p.brief_tom, p.brief_cor, p.brief_fonte, p.brief_refs,
                  p.extras, p.motivo, p.prazo_desejado, p.criada_em,
                  u.nome AS porta_voz_nome, u.apelido AS porta_voz_apelido
           FROM ofertas o
           JOIN pautas p ON p.id = o.pauta_id
           JOIN users u ON u.id = p.porta_voz_id
           WHERE o.editor_id = ? AND o.status = 'pendente' AND o.expira_em > ?
           LIMIT 1`,
        )
        .bind(editorId, clock().toISOString())
        .first<MissionOfferRow>();
      return row ? pendingOfferFromRow(row) : null;
    },

    async markEditorActive(editorId) {
      const now = clock();
      await db
        .prepare(
          `UPDATE users SET ultimo_visto_em = ?
           WHERE id = ?
             AND (ultimo_visto_em IS NULL OR ultimo_visto_em < ?)`,
        )
        .bind(
          now.toISOString(),
          editorId,
          new Date(now.getTime() - PRESENCE_WRITE_SECONDS * 1_000).toISOString(),
        )
        .run();
    },
  };
}
