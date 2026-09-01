import {
  type InvitationAdminRepository,
  type InvitationSummary,
  toInvitationSummary,
} from "../invitation-admin.ts";
import type { D1DatabaseLike } from "./types.ts";

/**
 * Paridade D1 da administração de convites.
 *
 * O SQLite não tem `now()` nem intervalo, então o instante e a expiração vêm
 * calculados de fora. A emissão continua sendo um passo só: o índice único
 * parcial idx_convites_porta_voz_email_aberto é a invariante, e a revogação do
 * convite aberto acontece na mesma instrução que insere o novo.
 */

type InvitationRow = Parameters<typeof toInvitationSummary>[0];

export function createD1InvitationAdmin(db: D1DatabaseLike): InvitationAdminRepository {
  return {
    async listInvitations(): Promise<InvitationSummary[]> {
      const now = new Date().toISOString();
      const { results } = await db
        .prepare(
          `SELECT c.id, c.email, c.created_at, c.expires_at, c.used_at, c.revoked_at,
                  criador.name AS created_by_name, usado.name AS used_by_name,
                  CASE
                    WHEN c.revoked_at IS NOT NULL THEN 'revogado'
                    WHEN c.used_at IS NOT NULL THEN 'usado'
                    WHEN c.expires_at <= ? THEN 'expirado'
                    ELSE 'valido'
                  END AS status
           FROM spokesperson_invitations c
           JOIN users criador ON criador.id = c.created_by
           LEFT JOIN users usado ON usado.id = c.used_by
           ORDER BY c.created_at DESC`,
        )
        .bind(now)
        .all<InvitationRow>();
      return results.map(toInvitationSummary);
    },

    async issueInvitation(input) {
      const now = new Date();
      const createdAt = now.toISOString();
      const expiresAt = new Date(
        now.getTime() + input.validityDays * 24 * 60 * 60 * 1000,
      ).toISOString();

      await db
        .prepare(
          `UPDATE spokesperson_invitations SET revoked_at = ?, revoked_by = ?
           WHERE lower(email) = lower(?) AND used_at IS NULL AND revoked_at IS NULL`,
        )
        .bind(createdAt, input.adminId, input.email)
        .run();

      try {
        const invitation = await db
          .prepare(
            `INSERT INTO spokesperson_invitations (email, token_hash, created_by, created_at, expires_at)
             VALUES (?, ?, ?, ?, ?)
             RETURNING id, email, expires_at`,
          )
          .bind(input.email, input.tokenHash, input.adminId, createdAt, expiresAt)
          .first<{ id: number; email: string; expires_at: string; expira_em?: string }>();
        if (!invitation) return { ok: false, reason: "issue_conflict" };

        await db
          .prepare(
            `INSERT INTO admin_audit (actor_id, action, entity, entity_id, details, created_at)
             VALUES (?, 'convite_criado', 'convite_porta_voz', ?, ?, ?)`,
          )
          .bind(
            input.adminId,
            String(invitation.id),
            JSON.stringify({ email: input.email }),
            createdAt,
          )
          .run();

        const expires = invitation.expires_at ?? invitation.expira_em ?? "";
        return {
          ok: true,
          id: Number(invitation.id),
          email: invitation.email,
          expiresAt: new Date(expires).toISOString(),
        };
      } catch (error) {
        if (/UNIQUE constraint failed/.test(String(error))) {
          return { ok: false, reason: "issue_conflict" };
        }
        throw error;
      }
    },

    async revokeInvitation(id, adminId) {
      const revokedAt = new Date().toISOString();
      const invitation = await db
        .prepare(
          `UPDATE spokesperson_invitations SET revoked_at = ?, revoked_by = ?
           WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL
           RETURNING id, email`,
        )
        .bind(revokedAt, adminId, id)
        .first<{ id: number; email: string }>();
      if (!invitation) return { ok: false, reason: "invitation_unavailable" };

      await db
        .prepare(
          `INSERT INTO admin_audit (actor_id, action, entity, entity_id, details, created_at)
           VALUES (?, 'convite_revogado', 'convite_porta_voz', ?, ?, ?)`,
        )
        .bind(adminId, String(id), JSON.stringify({ email: invitation.email }), revokedAt)
        .run();

      return { ok: true };
    },
  };
}
