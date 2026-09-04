import { isUniqueViolation, withTransaction } from "./client.ts";

/**
 * Administração dos convites de porta-voz.
 *
 * O resgate mora em invitation-redemption.ts; aqui ficam as três operações que
 * o inspetor realmente executa hoje — listar, emitir e revogar. A emissão roda
 * em transação porque revogar o convite aberto e inserir o novo são um passo
 * só: sem isso, duas emissões simultâneas para o mesmo e-mail disputam o índice
 * único parcial (idx_convites_porta_voz_email_aberto) e uma estoura.
 */

export type InvitationStatus = "valido" | "usado" | "expirado" | "revogado";

export type InvitationSummary = {
  id: number;
  email: string;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdByName: string;
  usedByName: string | null;
};

export type IssueInvitationInput = {
  /** Já normalizado por normalizeInvitationEmail. */
  email: string;
  tokenHash: string;
  adminId: number;
  validityDays: number;
};

export type IssueInvitationResult =
  | { ok: true; id: number; email: string; expiresAt: string }
  | { ok: false; reason: "issue_conflict" | "issue_failed" };

export type RevokeInvitationResult = { ok: true } | { ok: false; reason: "invitation_unavailable" };

export interface InvitationAdminRepository {
  listInvitations(): Promise<InvitationSummary[]>;
  issueInvitation(input: IssueInvitationInput): Promise<IssueInvitationResult>;
  revokeInvitation(id: number, adminId: number): Promise<RevokeInvitationResult>;
}

type InvitationRow = {
  id: number;
  email: string;
  status: InvitationStatus;
  created_at?: string;
  expires_at?: string;
  used_at?: string | null;
  revoked_at?: string | null;
  created_by_name?: string;
  used_by_name?: string | null;

  criado_em?: string;
  expira_em?: string;
  usado_em?: string | null;
  revogado_em?: string | null;
  criado_por_nome?: string;
  usado_por_nome?: string | null;
};

export function toInvitationSummary(row: InvitationRow): InvitationSummary {
  const createdAt = row.created_at ?? row.criado_em ?? "";
  const expiresAt = row.expires_at ?? row.expira_em ?? "";
  const usedAt = row.used_at ?? row.usado_em ?? null;
  const revokedAt = row.revoked_at ?? row.revogado_em ?? null;
  const createdByName = row.created_by_name ?? row.criado_por_nome ?? "";
  const usedByName = row.used_by_name ?? row.usado_por_nome ?? null;

  return {
    id: Number(row.id),
    email: row.email,
    status: row.status,
    createdAt: new Date(createdAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    usedAt: usedAt ? new Date(usedAt).toISOString() : null,
    revokedAt: revokedAt ? new Date(revokedAt).toISOString() : null,
    createdByName,
    usedByName,
  };
}

export const postgresInvitationAdmin: InvitationAdminRepository = {
  async listInvitations() {
    const rows = (await withTransaction(
      (transaction) => transaction`
        SELECT c.id, c.email, c.criado_em, c.expira_em, c.usado_em, c.revogado_em,
               criador.nome AS criado_por_nome, usado.nome AS usado_por_nome,
               CASE
                 WHEN c.revogado_em IS NOT NULL THEN 'revogado'
                 WHEN c.usado_em IS NOT NULL THEN 'usado'
                 WHEN c.expira_em <= now() THEN 'expirado'
                 ELSE 'valido'
               END AS status
        FROM convites_porta_voz c
        JOIN users criador ON criador.id = c.criado_por
        LEFT JOIN users usado ON usado.id = c.usado_por
        ORDER BY c.criado_em DESC
      `,
    )) as unknown as InvitationRow[];
    return rows.map(toInvitationSummary);
  },

  async issueInvitation(input) {
    try {
      return await withTransaction(async (transaction) => {
        await transaction`
          UPDATE convites_porta_voz
          SET revogado_em = now(), revogado_por = ${input.adminId}
          WHERE lower(email) = lower(${input.email})
            AND usado_em IS NULL AND revogado_em IS NULL
        `;
        const [invitation] = await transaction`
          INSERT INTO convites_porta_voz (email, token_hash, criado_por, expira_em)
          VALUES (
            ${input.email}, ${input.tokenHash}, ${input.adminId},
            now() + (${input.validityDays} || ' days')::interval
          )
          RETURNING id, email, expira_em
        `;
        if (!invitation) return { ok: false as const, reason: "issue_failed" as const };
        await transaction`
          INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes)
          VALUES (
            ${input.adminId}, 'convite_criado', 'convite_porta_voz',
            ${String(invitation.id)}, ${transaction.json({ email: input.email })}
          )
        `;
        return {
          ok: true as const,
          id: Number(invitation.id),
          email: invitation.email as string,
          expiresAt: new Date(invitation.expira_em as string).toISOString(),
        };
      });
    } catch (error) {
      if (isUniqueViolation(error)) return { ok: false, reason: "issue_conflict" };
      throw error;
    }
  },

  async revokeInvitation(id, adminId) {
    return withTransaction(async (transaction) => {
      const [invitation] = await transaction`
        UPDATE convites_porta_voz
        SET revogado_em = now(), revogado_por = ${adminId}
        WHERE id = ${id} AND usado_em IS NULL AND revogado_em IS NULL
        RETURNING id, email
      `;
      if (!invitation) return { ok: false as const, reason: "invitation_unavailable" as const };
      await transaction`
        INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes)
        VALUES (
          ${adminId}, 'convite_revogado', 'convite_porta_voz', ${String(id)},
          ${transaction.json({ email: invitation.email })}
        )
      `;
      return { ok: true as const };
    });
  },
};
