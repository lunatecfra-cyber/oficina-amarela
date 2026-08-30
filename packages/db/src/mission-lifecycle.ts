import { sql } from "./client.ts";

export type MissionActionFailure =
  | "mission_not_found"
  | "mission_not_held"
  | "mission_not_in_review"
  | "mission_not_awaiting_spokesperson"
  | "revision_notes_required";

export type MissionActionResult = { ok: true } | { ok: false; reason: MissionActionFailure };

export interface MissionLifecycleRepository {
  missionExists(missionId: number): Promise<boolean>;
  submitDelivery(
    missionId: number,
    editorId: number,
    delivery: { link: string | null; videoUrl: string | null },
  ): Promise<MissionActionResult>;
  requestInspectorRevision(missionId: number, notes: string): Promise<MissionActionResult>;
  finishMission(missionId: number, spokespersonId: number): Promise<MissionActionResult>;
  requestSpokespersonRevision(
    missionId: number,
    spokespersonId: number,
    notes: string,
  ): Promise<MissionActionResult>;
}

const failure = (reason: MissionActionFailure): MissionActionResult => ({ ok: false, reason });

async function transitionFailure(
  missionId: number,
  reason: MissionActionFailure,
): Promise<MissionActionResult> {
  const [mission] = await sql`SELECT id FROM pautas WHERE id = ${missionId}`;
  return failure(mission ? reason : "mission_not_found");
}

export const postgresMissionLifecycle: MissionLifecycleRepository = {
  async missionExists(missionId) {
    const [mission] = await sql`SELECT id FROM pautas WHERE id = ${missionId}`;
    return Boolean(mission);
  },

  async submitDelivery(missionId, editorId, delivery) {
    const rows = await sql`
      UPDATE pautas
      SET status = 'em_revisao',
          entrega_link = ${delivery.link},
          video_entrega_url = ${delivery.videoUrl},
          notas_inspetor = NULL
      WHERE id = ${missionId} AND reservada_por_id = ${editorId}
        AND status IN ('reservada', 'reedicao')
      RETURNING id
    `;
    return rows.length > 0 ? { ok: true } : transitionFailure(missionId, "mission_not_held");
  },

  async requestInspectorRevision(missionId, notes) {
    const cleanNotes = notes.trim();
    if (!cleanNotes) return failure("revision_notes_required");

    const rows = await sql`
      UPDATE pautas SET status = 'reedicao', notas_inspetor = ${cleanNotes},
                        reedicao_pedida_por = 'inspetor'
      WHERE id = ${missionId} AND status = 'em_revisao'
      RETURNING id
    `;
    return rows.length > 0 ? { ok: true } : transitionFailure(missionId, "mission_not_in_review");
  },

  async finishMission(missionId, spokespersonId) {
    const rows = await sql`
      UPDATE pautas SET status = 'finalizada'
      WHERE id = ${missionId} AND porta_voz_id = ${spokespersonId} AND status = 'aprovada'
      RETURNING id
    `;
    return rows.length > 0
      ? { ok: true }
      : transitionFailure(missionId, "mission_not_awaiting_spokesperson");
  },

  async requestSpokespersonRevision(missionId, spokespersonId, notes) {
    const cleanNotes = notes.trim();
    if (!cleanNotes) return failure("revision_notes_required");

    const rows = await sql`
      UPDATE pautas SET status = 'reedicao', notas_inspetor = ${cleanNotes},
                        reedicao_pedida_por = 'porta_voz'
      WHERE id = ${missionId} AND porta_voz_id = ${spokespersonId}
        AND status IN ('em_revisao', 'aprovada')
      RETURNING id
    `;
    return rows.length > 0
      ? { ok: true }
      : transitionFailure(missionId, "mission_not_awaiting_spokesperson");
  },
};
