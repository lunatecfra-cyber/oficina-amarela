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
          `SELECT c.id, c.email, c.criado_em, c.expira_em, c.usado_em, c.revogado_em,
                  criador.nome AS criado_por_nome, usado.nome AS usado_por_nome,
                  CASE
                    WHEN c.revogado_em IS NOT NULL THEN 'revogado'
                    WHEN c.usado_em IS NOT NULL THEN 'usado'
                    WHEN c.expira_em <= ? THEN 'expirado'
                    ELSE 'valido'
                  END AS status
           FROM convites_porta_voz c
           JOIN users criador ON criador.id = c.criado_por
           LEFT JOIN users usado ON usado.id = c.usado_por
           ORDER BY c.criado_em DESC`,
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
          `UPDATE convites_porta_voz SET revogado_em = ?, revogado_por = ?
           WHERE lower(email) = lower(?) AND usado_em IS NULL AND revogado_em IS NULL`,
        )
        .bind(createdAt, input.adminId, input.email)
        .run();

      try {
        const invitation = await db
          .prepare(
            `INSERT INTO convites_porta_voz (email, token_hash, criado_por, criado_em, expira_em)
             VALUES (?, ?, ?, ?, ?)
             RETURNING id, email, expira_em`,
          )
          .bind(input.email, input.tokenHash, input.adminId, createdAt, expiresAt)
          .first<{ id: number; email: string; expira_em: string }>();
        if (!invitation) return { ok: false, reason: "issue_conflict" };

        await db
          .prepare(
            `INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes, criado_em)
             VALUES (?, 'convite_criado', 'convite_porta_voz', ?, ?, ?)`,
          )
          .bind(
            input.adminId,
            String(invitation.id),
            JSON.stringify({ email: input.email }),
            createdAt,
          )
          .run();

        return {
          ok: true,
          id: Number(invitation.id),
          email: invitation.email,
          expiresAt: new Date(invitation.expira_em).toISOString(),
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
          `UPDATE convites_porta_voz SET revogado_em = ?, revogado_por = ?
           WHERE id = ? AND usado_em IS NULL AND revogado_em IS NULL
           RETURNING id, email`,
        )
        .bind(revokedAt, adminId, id)
        .first<{ id: number; email: string }>();
      if (!invitation) return { ok: false, reason: "invitation_unavailable" };

      await db
        .prepare(
          `INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes, criado_em)
           VALUES (?, 'convite_revogado', 'convite_porta_voz', ?, ?, ?)`,
        )
        .bind(adminId, String(id), JSON.stringify({ email: invitation.email }), revokedAt)
        .run();

      return { ok: true };
    },
  };
}
