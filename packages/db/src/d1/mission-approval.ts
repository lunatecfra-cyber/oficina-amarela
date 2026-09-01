import type {
  ApproveMissionInput,
  MissionApprovalRepository,
  MissionApprovalResult,
} from "../mission-approval.ts";
import type { D1DatabaseLike } from "./types.ts";

type ApprovalState = {
  spokesperson_id: number;
  reserved_by_id: number | null;
  status: string;
  is_scored: number;
  approval_status: string | null;
};

export function createD1MissionApproval(db: D1DatabaseLike): MissionApprovalRepository {
  async function currentState(input: ApproveMissionInput): Promise<MissionApprovalResult> {
    const state = await db
      .prepare(
        `SELECT p.spokesperson_id, p.reserved_by_id, p.status, p.is_scored,
                a.status_final AS approval_status
         FROM missions p LEFT JOIN mission_approvals a ON a.mission_id = p.id
         WHERE p.id = ?`,
      )
      .bind(input.missionId)
      .first<ApprovalState>();
    if (!state) return { ok: false, reason: "mission_not_found" };
    if (input.actor.role === "spokesperson" && state.spokesperson_id !== input.actor.id) {
      return { ok: false, reason: "forbidden" };
    }
    const expectedStatus = input.actor.role === "admin" ? "aprovada" : "finalizada";
    if (state.approval_status === expectedStatus && state.reserved_by_id) {
      return {
        ok: true,
        editorId: state.reserved_by_id,
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
               mission_id, editor_id, approved_by, status_final, rating, comment, approved_at
             )
             SELECT id, reserved_by_id, ?, ?, ?, ?, ?
             FROM missions
             WHERE id = ? AND status = 'em_revisao' AND is_scored = 0
               AND reserved_by_id IS NOT NULL
               AND (? = 'admin' OR spokesperson_id = ?)
             ON CONFLICT (mission_id) DO NOTHING
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
          .prepare("SELECT invitee_id FROM referral_rewards WHERE invitee_id = ?")
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
