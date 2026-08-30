import { isUniqueViolation, type TransactionSql, withTransaction } from "./client.ts";

export type InvitationRedemptionFailure =
  | "invitation_not_found"
  | "email_mismatch"
  | "invitation_revoked"
  | "invitation_used"
  | "invitation_expired"
  | "account_conflict";

export type InvitationRedemptionResult =
  | { ok: true; userId: number }
  | { ok: false; reason: InvitationRedemptionFailure };

export type RedeemInvitationInput = {
  tokenHash: string;
  email: string;
  handle: string;
  name: string;
  passwordHash?: string | null;
  googleId?: string | null;
  avatarUrl?: string | null;
  referralCode?: string | null;
};

export interface InvitationRedemptionRepository {
  redeemInvitation(input: RedeemInvitationInput): Promise<InvitationRedemptionResult>;
}

type InvitationRow = {
  id: number;
  email: string;
  criado_por: number;
  expira_em: string;
  usado_em: string | null;
  revogado_em: string | null;
};

async function redeem(
  transaction: TransactionSql,
  input: RedeemInvitationInput,
): Promise<InvitationRedemptionResult> {
  const [invitation] = (await transaction`
    SELECT id, email, criado_por, expira_em, usado_em, revogado_em
    FROM convites_porta_voz WHERE token_hash = ${input.tokenHash}
    FOR UPDATE
  `) as unknown as InvitationRow[];
  if (!invitation) return { ok: false, reason: "invitation_not_found" };
  if (invitation.email.toLowerCase() !== input.email.trim().toLowerCase()) {
    return { ok: false, reason: "email_mismatch" };
  }
  if (invitation.revogado_em) return { ok: false, reason: "invitation_revoked" };
  if (invitation.usado_em) return { ok: false, reason: "invitation_used" };
  if (new Date(invitation.expira_em).getTime() <= Date.now()) {
    return { ok: false, reason: "invitation_expired" };
  }

  const [user] = await transaction`
    INSERT INTO users (
      apelido, nome, email, senha_hash, google_id, papel, foto_url, indicado_por_id
    ) VALUES (
      ${input.handle}, ${input.name}, ${input.email}, ${input.passwordHash ?? null},
      ${input.googleId ?? null}, 'voz', ${input.avatarUrl ?? null},
      (SELECT id FROM users WHERE codigo_indicacao = ${input.referralCode ?? null}::uuid)
    )
    RETURNING id
  `;
  await transaction`
    UPDATE convites_porta_voz SET usado_em = now(), usado_por = ${user.id}
    WHERE id = ${invitation.id}
  `;
  await transaction`
    INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes)
    VALUES (
      ${invitation.criado_por}, 'convite_consumido', 'convite_porta_voz',
      ${String(invitation.id)}, ${transaction.json({ email: input.email, user_id: user.id })}
    )
  `;
  return { ok: true, userId: user.id as number };
}

export const postgresInvitationRedemption: InvitationRedemptionRepository = {
  async redeemInvitation(input) {
    try {
      return await withTransaction((transaction) => redeem(transaction, input));
    } catch (error) {
      if (isUniqueViolation(error)) return { ok: false, reason: "account_conflict" };
      throw error;
    }
  },
};
