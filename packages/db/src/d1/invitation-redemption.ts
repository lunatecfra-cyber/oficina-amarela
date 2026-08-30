import type {
  InvitationRedemptionRepository,
  InvitationRedemptionResult,
  RedeemInvitationInput,
} from "../invitation-redemption.ts";
import type { D1DatabaseLike } from "./types.ts";

type InvitationState = {
  email: string;
  expira_em: string;
  usado_em: string | null;
  revogado_em: string | null;
};

export function createD1InvitationRedemption(db: D1DatabaseLike): InvitationRedemptionRepository {
  async function failure(input: RedeemInvitationInput): Promise<InvitationRedemptionResult> {
    const invitation = await db
      .prepare(
        "SELECT email, expira_em, usado_em, revogado_em FROM convites_porta_voz WHERE token_hash = ?",
      )
      .bind(input.tokenHash)
      .first<InvitationState>();
    if (!invitation) return { ok: false, reason: "invitation_not_found" };
    if (invitation.email.toLowerCase() !== input.email.trim().toLowerCase()) {
      return { ok: false, reason: "email_mismatch" };
    }
    if (invitation.revogado_em) return { ok: false, reason: "invitation_revoked" };
    if (invitation.usado_em) return { ok: false, reason: "invitation_used" };
    if (new Date(invitation.expira_em).getTime() <= Date.now()) {
      return { ok: false, reason: "invitation_expired" };
    }
    return { ok: false, reason: "account_conflict" };
  }

  return {
    async redeemInvitation(input) {
      try {
        const redeemedAt = new Date().toISOString();
        const inserted = await db
          .prepare(
            `INSERT INTO invitation_redemptions (
               token_hash, email, apelido, nome, senha_hash, google_id,
               foto_url, codigo_indicacao, resgatado_em
             )
             SELECT token_hash, ?, ?, ?, ?, ?, ?, ?, ?
             FROM convites_porta_voz
             WHERE token_hash = ? AND lower(email) = lower(?)
               AND usado_em IS NULL AND revogado_em IS NULL AND expira_em > ?
             ON CONFLICT (token_hash) DO NOTHING
             RETURNING token_hash`,
          )
          .bind(
            input.email,
            input.handle,
            input.name,
            input.passwordHash ?? null,
            input.googleId ?? null,
            input.avatarUrl ?? null,
            input.referralCode ?? null,
            redeemedAt,
            input.tokenHash,
            input.email,
            redeemedAt,
          )
          .first();
        if (!inserted) return failure(input);
        const user = await db
          .prepare("SELECT id FROM users WHERE lower(email) = lower(?)")
          .bind(input.email)
          .first<{ id: number }>();
        return { ok: true, userId: user?.id as number };
      } catch (error) {
        if (/UNIQUE constraint failed|invitation_unavailable/.test(String(error))) {
          return failure(input);
        }
        throw error;
      }
    },
  };
}
