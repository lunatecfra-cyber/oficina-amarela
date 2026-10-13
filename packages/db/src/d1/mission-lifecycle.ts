import type {
  MissionActionFailure,
  MissionActionResult,
  MissionLifecycleRepository,
} from "../mission-lifecycle.ts";
import type { D1DatabaseLike } from "./types.ts";

export type { D1DatabaseLike } from "./types.ts";

const failure = (reason: MissionActionFailure): MissionActionResult => ({ ok: false, reason });

export function createD1MissionLifecycle(db: D1DatabaseLike): MissionLifecycleRepository {
  async function missionExists(missionId: number): Promise<boolean> {
    return Boolean(
      await db.prepare("SELECT id FROM missions WHERE id = ?").bind(missionId).first(),
    );
  }

  async function transitionFailure(
    missionId: number,
    reason: MissionActionFailure,
  ): Promise<MissionActionResult> {
    return failure((await missionExists(missionId)) ? reason : "mission_not_found");
  }

  return {
    missionExists,

    async submitDelivery(missionId, editorId, delivery) {
      const result = await db
        .prepare(
          `UPDATE missions
           SET status = 'em_revisao', delivery_link = ?, delivery_video_url = ?, inspector_notes = NULL,
               delivery_version = delivery_version + 1, inspection_required = ?, inspection_reason = ?
           WHERE id = ? AND reserved_by_id = ? AND status IN ('reservada', 'reedicao')
             AND (? IS NULL OR delivery_version = ?)`,
        )
        .bind(
          delivery.link,
          delivery.videoUrl,
          delivery.inspectionRequired === false ? 0 : 1,
          delivery.inspectionReason ?? "parameters_pending",
          missionId,
          editorId,
          delivery.expectedVersion ?? null,
          delivery.expectedVersion ?? null,
        )
        .run();
      return result.meta.changes > 0
        ? { ok: true }
        : transitionFailure(missionId, "mission_not_held");
    },

    async requestInspectorRevision(missionId, notes, expectedVersion, inspectorId) {
      const cleanNotes = notes.trim();
      if (!cleanNotes) return failure("revision_notes_required");

      const result = await db
        .prepare(
          `INSERT INTO mission_inspections(mission_id,version,inspector_id,comment,decision,inspected_at)
           SELECT p.id,p.delivery_version,u.id,?,'revision_requested',strftime('%Y-%m-%dT%H:%M:%fZ','now')
           FROM missions p JOIN users u ON u.id=? AND u.role='admin' AND u.is_banned=0
           WHERE p.id=? AND p.status='em_revisao' AND p.reserved_by_id<>u.id AND (? IS NULL OR p.delivery_version=?)
           ON CONFLICT(mission_id,version) DO NOTHING`,
        )
        .bind(
          cleanNotes,
          inspectorId ?? null,
          missionId,
          expectedVersion ?? null,
          expectedVersion ?? null,
        )
        .run();
      return result.meta.changes > 0
        ? { ok: true }
        : transitionFailure(missionId, "mission_not_in_review");
    },

    async finishMission(missionId, spokespersonId, expectedVersion) {
      const result = await db
        .prepare(
          `UPDATE missions SET status = 'finalizada'
           WHERE id = ? AND spokesperson_id = ? AND status = 'aprovada' AND (? IS NULL OR delivery_version = ?)
             AND (inspection_required=0 OR EXISTS(SELECT 1 FROM mission_inspections i WHERE i.mission_id=missions.id AND i.version=missions.delivery_version AND i.decision='approved' AND i.inspector_id<>missions.reserved_by_id))`,
        )
        .bind(missionId, spokespersonId, expectedVersion ?? null, expectedVersion ?? null)
        .run();
      return result.meta.changes > 0
        ? { ok: true }
        : transitionFailure(missionId, "mission_not_awaiting_spokesperson");
    },

    async requestSpokespersonRevision(missionId, spokespersonId, notes, expectedVersion) {
      const cleanNotes = notes.trim();
      if (!cleanNotes) return failure("revision_notes_required");

      const result = await db
        .prepare(
          `UPDATE missions
           SET status = 'reedicao', inspector_notes = ?, revision_requested_by = 'porta_voz'
           WHERE id = ? AND spokesperson_id = ? AND status IN ('em_revisao', 'aprovada') AND (? IS NULL OR delivery_version = ?)`,
        )
        .bind(
          cleanNotes,
          missionId,
          spokespersonId,
          expectedVersion ?? null,
          expectedVersion ?? null,
        )
        .run();
      return result.meta.changes > 0
        ? { ok: true }
        : transitionFailure(missionId, "mission_not_awaiting_spokesperson");
    },
  };
}
