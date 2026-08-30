import { createHash, randomBytes } from "node:crypto";
import { sql } from "@/lib/db";

const VALIDITY_DAYS = 7;

export function hashInvitation(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export const hashConvite = hashInvitation;

export async function createSpokespersonInvitation(email: string, inspectorId: number) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return {
      ok: false as const,
      error: "Digite um e-mail válido.",
      erro: "Digite um e-mail válido.",
    };
  }

  const token = randomBytes(32).toString("hex");
  await sql`
    UPDATE convites_porta_voz
    SET revogado_em = now(), revogado_por = ${inspectorId}
    WHERE lower(email) = lower(${normalized}) AND usado_em IS NULL AND revogado_em IS NULL
  `;
  const [invitation] = await sql`
    INSERT INTO convites_porta_voz (email, token_hash, criado_por, expira_em)
    VALUES (${normalized}, ${hashInvitation(token)}, ${inspectorId}, now() + (${VALIDITY_DAYS} || ' days')::interval)
    RETURNING id, email, expira_em
  `;
  await sql`
    INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes)
    VALUES (${inspectorId}, 'convite_criado', 'convite_porta_voz', ${String(invitation.id)},
            ${sql.json({ email: normalized })})
  `;
  return {
    ok: true as const,
    token,
    id: Number(invitation.id),
    email: normalized,
    expiresAt: invitation.expira_em,
    expiraEm: invitation.expira_em,
  };
}
export const criarConvitePortaVoz = createSpokespersonInvitation;

export async function listSpokespersonInvitations() {
  return sql`
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
  `;
}
export const listarConvitesPortaVoz = listSpokespersonInvitations;

export async function revokeSpokespersonInvitation(id: number, inspectorId: number) {
  const [invitation] = await sql`
    UPDATE convites_porta_voz
    SET revogado_em = now(), revogado_por = ${inspectorId}
    WHERE id = ${id} AND usado_em IS NULL AND revogado_em IS NULL
    RETURNING id, email
  `;
  if (!invitation)
    return {
      ok: false as const,
      error: "Convite não está disponível para revogação.",
      erro: "Convite não está disponível para revogação.",
    };
  await sql`
    INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes)
    VALUES (${inspectorId}, 'convite_revogado', 'convite_porta_voz', ${String(id)},
            ${sql.json({ email: invitation.email })})
  `;
  return { ok: true as const };
}
export const revogarConvitePortaVoz = revokeSpokespersonInvitation;

export async function validateSpokespersonInvitation(token: string, email: string) {
  if (!token)
    return {
      ok: false as const,
      error: "Convite especial obrigatório para porta-voz.",
      erro: "Convite especial obrigatório para porta-voz.",
    };
  const [invitation] = await sql`
    SELECT email, expira_em, usado_em, revogado_em
    FROM convites_porta_voz WHERE token_hash = ${hashInvitation(token)}
  `;
  if (!invitation)
    return { ok: false as const, error: "Convite inválido.", erro: "Convite inválido." };
  if (String(invitation.email).toLowerCase() !== email.trim().toLowerCase()) {
    return {
      ok: false as const,
      error: "Este convite pertence a outro e-mail.",
      erro: "Este convite pertence a outro e-mail.",
    };
  }
  if (invitation.revogado_em)
    return {
      ok: false as const,
      error: "Este convite foi revogado.",
      erro: "Este convite foi revogado.",
    };
  if (invitation.usado_em)
    return {
      ok: false as const,
      error: "Este convite já foi usado.",
      erro: "Este convite já foi usado.",
    };
  if (new Date(invitation.expira_em).getTime() <= Date.now()) {
    return { ok: false as const, error: "Este convite expirou.", erro: "Este convite expirou." };
  }
  return { ok: true as const, tokenHash: hashInvitation(token) };
}
export const validarConvitePortaVoz = validateSpokespersonInvitation;
