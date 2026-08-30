import type {
  ApproveMissionInput,
  MissionApprovalRepository,
  MissionApprovalResult,
} from "../mission-approval.ts";
import type { D1DatabaseLike } from "./types.ts";

type ApprovalState = {
  porta_voz_id: number;
  reservada_por_id: number | null;
  status: string;
  pontuada: number;
  approval_status: string | null;
};

export function createD1MissionApproval(db: D1DatabaseLike): MissionApprovalRepository {
  async function currentState(input: ApproveMissionInput): Promise<MissionApprovalResult> {
    const state = await db
      .prepare(
        `SELECT p.porta_voz_id, p.reservada_por_id, p.status, p.pontuada,
                a.status_final AS approval_status
         FROM pautas p LEFT JOIN mission_approvals a ON a.pauta_id = p.id
         WHERE p.id = ?`,
      )
      .bind(input.missionId)
      .first<ApprovalState>();
    if (!state) return { ok: false, reason: "mission_not_found" };
    if (input.actor.role === "spokesperson" && state.porta_voz_id !== input.actor.id) {
      return { ok: false, reason: "forbidden" };
    }
    const expectedStatus = input.actor.role === "admin" ? "aprovada" : "finalizada";
    if (state.approval_status === expectedStatus && state.reservada_por_id) {
      return {
        ok: true,
        editorId: state.reservada_por_id,
        scored: false,
        referralAwarded: false,
      };
    }
    return { ok: false, reason: "mission_not_in_review" };
  }

  return {
    async approveMission(input) {
      if (
        input.rating !== undefined &&
        (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
      ) {
        return { ok: false, reason: "invalid_rating" };
      }
      if (input.actor.role !== "admin" && input.actor.role !== "spokesperson") {
        return { ok: false, reason: "forbidden" };
      }

      const finalStatus = input.actor.role === "admin" ? "aprovada" : "finalizada";
      const approvedAt = new Date().toISOString();
      try {
        const inserted = await db
          .prepare(
            `INSERT INTO mission_approvals (
               pauta_id, editor_id, aprovado_por, status_final, nota, comentario, aprovado_em
             )
             SELECT id, reservada_por_id, ?, ?, ?, ?, ?
             FROM pautas
             WHERE id = ? AND status = 'em_revisao' AND pontuada = 0
               AND reservada_por_id IS NOT NULL
               AND (? = 'admin' OR porta_voz_id = ?)
             ON CONFLICT (pauta_id) DO NOTHING
             RETURNING editor_id`,
          )
          .bind(
            input.actor.id,
            finalStatus,
            input.rating ?? null,
            input.comment?.trim() || null,
            approvedAt,
            input.missionId,
            input.actor.role,
            input.actor.id,
          )
          .first<{ editor_id: number }>();
        if (!inserted) return currentState(input);
        const referral = await db
          .prepare("SELECT convidado_id FROM indicacoes_recompensas WHERE convidado_id = ?")
          .bind(inserted.editor_id)
          .first();
        return {
          ok: true,
          editorId: inserted.editor_id,
          scored: true,
          referralAwarded: Boolean(referral),
        };
      } catch (error) {
        if (String(error).includes("mission_not_in_review")) return currentState(input);
        throw error;
      }
    },
  };
}
