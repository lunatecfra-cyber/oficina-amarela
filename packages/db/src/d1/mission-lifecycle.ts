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
           SET status = 'em_revisao', delivery_link = ?, delivery_video_url = ?, inspector_notes = NULL
           WHERE id = ? AND reserved_by_id = ? AND status IN ('reservada', 'reedicao')`,
        )
        .bind(delivery.link, delivery.videoUrl, missionId, editorId)
        .run();
      return result.meta.changes > 0
        ? { ok: true }
        : transitionFailure(missionId, "mission_not_held");
    },

    async requestInspectorRevision(missionId, notes) {
      const cleanNotes = notes.trim();
      if (!cleanNotes) return failure("revision_notes_required");

      const result = await db
        .prepare(
          `UPDATE missions
           SET status = 'reedicao', inspector_notes = ?, revision_requested_by = 'inspetor'
           WHERE id = ? AND status = 'em_revisao'`,
        )
        .bind(cleanNotes, missionId)
        .run();
      return result.meta.changes > 0
        ? { ok: true }
        : transitionFailure(missionId, "mission_not_in_review");
    },

    async finishMission(missionId, spokespersonId) {
      const result = await db
        .prepare(
          `UPDATE missions SET status = 'finalizada'
           WHERE id = ? AND spokesperson_id = ? AND status = 'aprovada'`,
        )
        .bind(missionId, spokespersonId)
        .run();
      return result.meta.changes > 0
        ? { ok: true }
        : transitionFailure(missionId, "mission_not_awaiting_spokesperson");
    },

    async requestSpokespersonRevision(missionId, spokespersonId, notes) {
      const cleanNotes = notes.trim();
      if (!cleanNotes) return failure("revision_notes_required");

      const result = await db
        .prepare(
          `UPDATE missions
           SET status = 'reedicao', inspector_notes = ?, revision_requested_by = 'porta_voz'
           WHERE id = ? AND spokesperson_id = ? AND status IN ('em_revisao', 'aprovada')`,
        )
        .bind(cleanNotes, missionId, spokespersonId)
        .run();
      return result.meta.changes > 0
        ? { ok: true }
        : transitionFailure(missionId, "mission_not_awaiting_spokesperson");
    },
  };
}
