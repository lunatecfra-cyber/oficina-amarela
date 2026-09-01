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
  return (
    errorIncludes(error, "UNIQUE constraint failed: missions.reserved_by_id") ||
    errorIncludes(error, "UNIQUE constraint failed: pautas.reservada_por_id")
  );
}

function isOfferConflict(error: unknown): boolean {
  return (
    errorIncludes(error, "UNIQUE constraint failed: offers.") ||
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
       WHERE u.role = 'editor'
         AND u.last_seen_at > ?
         AND (u.reservations_locked_until IS NULL OR u.reservations_locked_until <= ?)
         AND (
           u.availability IS NULL
           OR json_extract(u.availability, ?) IS NULL
           OR json_extract(u.availability, ?) = 1
         )
         AND NOT EXISTS (
           SELECT 1 FROM missions p
           WHERE p.reserved_by_id = u.id
             AND p.status IN ('reservada', 'em_revisao', 'reedicao')
         )
         AND NOT EXISTS (
           SELECT 1 FROM offers o WHERE o.editor_id = u.id AND o.status = 'pendente'
         )
         AND NOT EXISTS (
           SELECT 1 FROM offers o WHERE o.editor_id = u.id AND o.mission_id = ?
         )
       ORDER BY
         (SELECT COUNT(*) FROM missions h
          WHERE h.reserved_by_id = u.id
            AND h.spokesperson_id = ?
            AND h.status IN ('aprovada', 'finalizada')) DESC,
         u.delivered_count DESC,
         u.last_seen_at ASC
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
          `SELECT id FROM missions
           WHERE reserved_by_id = ? AND status IN ('reservada', 'em_revisao', 'reedicao')`,
        )
        .bind(editorId)
        .first();
      if (active) return failure("already_holds_mission");

      try {
        const result = await db
          .prepare(
            `UPDATE missions
             SET status = 'reservada', reserved_by_id = ?, reserved_at = ?
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
          `UPDATE missions
           SET status = 'disponivel', reserved_by_id = NULL,
               reserved_until = NULL, reserved_at = NULL
           WHERE id = ? AND reserved_by_id = ? AND status IN ('reservada', 'reedicao')`,
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
            `UPDATE offers
             SET status = 'aceita', answered_at = ?
             WHERE mission_id = ? AND editor_id = ?
               AND status = 'pendente' AND expires_at > ?`,
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
          `UPDATE offers
           SET status = 'rejeitada', answered_at = ?
           WHERE mission_id = ? AND editor_id = ? AND status = 'pendente'`,
        )
        .bind(clock().toISOString(), missionId, editorId)
        .run();
      return result.meta.changes > 0 ? { ok: true } : failure("offer_invalid");
    },

    async dispatchOffers() {
      const { results: missions } = await db
        .prepare(
          `SELECT id, spokesperson_id FROM missions
           WHERE status = 'disponivel'
           ORDER BY priority DESC, created_at ASC
           LIMIT 20`,
        )
        .all<{ id: number; spokesperson_id: number }>();

      let dispatched = 0;
      for (const mission of missions) {
        const now = clock();
        const editorId = await nextEligibleEditor(db, mission.id, mission.spokesperson_id, now);
        if (!editorId) continue;

        try {
          const offeredAt = now.toISOString();
          const expiresAt = new Date(now.getTime() + OFFER_MINUTES * 60_000).toISOString();
          const result = await db
            .prepare(
              `INSERT INTO offers
                 (mission_id, editor_id, status, offered_at, expires_at, position)
               VALUES
                 (?, ?, 'pendente', ?, ?,
                  (SELECT COALESCE(MAX(position), 0) + 1 FROM offers WHERE mission_id = ?))`,
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
          `UPDATE offers
           SET status = 'expirada', answered_at = ?
           WHERE status = 'pendente'
             AND (
               offered_at <= ?
               OR EXISTS (
                 SELECT 1 FROM users u
                 WHERE u.id = offers.editor_id AND u.last_seen_at <= ?
               )
             )
           RETURNING mission_id`,
        )
        .bind(
          now.toISOString(),
          new Date(now.getTime() - OFFER_MINUTES * 60_000).toISOString(),
          new Date(now.getTime() - PRESENCE_MINUTES * 60_000).toISOString(),
        )
        .all<{ mission_id: number }>();
      return results.length;
    },

    async pendingOfferFor(editorId) {
      const row = await db
        .prepare(
          `SELECT o.expires_at, o.position,
                  p.id, p.title, p.format, p.drive_link, p.youtube_link, p.status,
                  p.brief_tone, p.brief_color, p.brief_font, p.brief_refs,
                  p.extras, p.motivation, p.desired_deadline, p.created_at,
                  u.name AS spokesperson_name, u.handle AS spokesperson_handle
           FROM offers o
           JOIN missions p ON p.id = o.mission_id
           JOIN users u ON u.id = p.spokesperson_id
           WHERE o.editor_id = ? AND o.status = 'pendente' AND o.expires_at > ?
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
          `UPDATE users SET last_seen_at = ?
           WHERE id = ?
             AND (last_seen_at IS NULL OR last_seen_at < ?)`,
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
