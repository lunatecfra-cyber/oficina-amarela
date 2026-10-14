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
  delivery_version: number;
  inspected_at: string | null;
  assigned_inspector_id: number | null;
};

export function createD1MissionApproval(db: D1DatabaseLike): MissionApprovalRepository {
  async function currentState(input: ApproveMissionInput): Promise<MissionApprovalResult> {
    const state = await db
      .prepare(
        `SELECT p.spokesperson_id, p.reserved_by_id, p.status, p.is_scored,
                a.status_final AS approval_status, p.delivery_version, i.inspected_at, (SELECT inspector_id FROM mission_inspection_assignments WHERE mission_id=d.mission_id AND version=d.version) AS assigned_inspector_id
         FROM missions p LEFT JOIN mission_approvals a ON a.mission_id = p.id
         LEFT JOIN mission_inspections i ON i.mission_id=p.id AND i.version=p.delivery_version
         LEFT JOIN mission_deliveries d ON d.mission_id=p.id AND d.version=p.delivery_version
         WHERE p.id = ?`,
      )
      .bind(input.missionId)
      .first<ApprovalState>();
    if (!state) return { ok: false, reason: "mission_not_found" };
    if (
      !["admin", "inspector"].includes(input.actor.role) ||
      state.reserved_by_id === input.actor.id ||
      (input.actor.role === "inspector" && state.assigned_inspector_id !== input.actor.id)
    ) {
      return { ok: false, reason: "forbidden" };
    }
    if (input.expectedVersion !== undefined && state.delivery_version !== input.expectedVersion)
      return { ok: false, reason: "mission_not_in_review" };
    if (
      state.inspected_at &&
      ["aprovada", "finalizada"].includes(state.status) &&
      state.reserved_by_id
    ) {
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
      if (!["admin", "inspector"].includes(input.actor.role)) {
        return { ok: false, reason: "forbidden" };
      }

      const approvedAt = new Date().toISOString();
      try {
        const inserted = await db
          .prepare(
            `INSERT INTO mission_inspections (mission_id,version,inspector_id,rating,comment,inspected_at)
             SELECT id,delivery_version,?,?,?,?
             FROM missions
             WHERE id = ? AND status = 'em_revisao'
               AND reserved_by_id IS NOT NULL
               AND reserved_by_id <> ? AND (? IS NULL OR delivery_version=?)
             ON CONFLICT (mission_id,version) DO NOTHING
             RETURNING version`,
          )
          .bind(
            input.actor.id,
            input.rating ?? null,
            input.comment?.trim() || null,
            approvedAt,
            input.missionId,
            input.actor.id,
            input.expectedVersion ?? null,
            input.expectedVersion ?? null,
          )
          .first<{ version: number }>();
        if (!inserted) return currentState(input);
        const inspection = await db
          .prepare(
            "SELECT p.reserved_by_id AS editor_id,i.scored FROM mission_inspections i JOIN missions p ON p.id=i.mission_id WHERE i.mission_id=? AND i.version=?",
          )
          .bind(input.missionId, inserted.version)
          .first<{ editor_id: number; scored: number }>();
        const referral = await db
          .prepare("SELECT invitee_id FROM referral_rewards WHERE invitee_id = ?")
          .bind(inspection!.editor_id)
          .first();
        return {
          ok: true,
          editorId: inspection!.editor_id,
          scored: inspection!.scored === 1,
          referralAwarded: Boolean(referral),
        };
      } catch (error) {
        if (/mission_not_in_review|inspection_unavailable/.test(String(error)))
          return currentState(input);
        throw error;
      }
    },
  };
}
