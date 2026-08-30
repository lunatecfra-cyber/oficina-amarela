import type {
  MissionActionFailure,
  MissionActionResult,
  MissionLifecycleRepository,
} from "../mission-lifecycle.ts";

type D1ResultLike = { meta: { changes: number } };

type D1PreparedStatementLike = {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1ResultLike>;
};

export type D1DatabaseLike = {
  prepare(query: string): D1PreparedStatementLike;
};

const failure = (reason: MissionActionFailure): MissionActionResult => ({ ok: false, reason });

export function createD1MissionLifecycle(db: D1DatabaseLike): MissionLifecycleRepository {
  async function missionExists(missionId: number): Promise<boolean> {
    return Boolean(await db.prepare("SELECT id FROM pautas WHERE id = ?").bind(missionId).first());
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
          `UPDATE pautas
           SET status = 'em_revisao', entrega_link = ?, video_entrega_url = ?, notas_inspetor = NULL
           WHERE id = ? AND reservada_por_id = ? AND status IN ('reservada', 'reedicao')`,
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
          `UPDATE pautas
           SET status = 'reedicao', notas_inspetor = ?, reedicao_pedida_por = 'inspetor'
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
          `UPDATE pautas SET status = 'finalizada'
           WHERE id = ? AND porta_voz_id = ? AND status = 'aprovada'`,
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
          `UPDATE pautas
           SET status = 'reedicao', notas_inspetor = ?, reedicao_pedida_por = 'porta_voz'
           WHERE id = ? AND porta_voz_id = ? AND status IN ('em_revisao', 'aprovada')`,
        )
        .bind(cleanNotes, missionId, spokespersonId)
        .run();
      return result.meta.changes > 0
        ? { ok: true }
        : transitionFailure(missionId, "mission_not_awaiting_spokesperson");
    },
  };
}
