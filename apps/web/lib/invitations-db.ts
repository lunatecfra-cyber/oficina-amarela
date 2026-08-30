import { hashInvitation } from "@oficina/domain/invitations";
import { sql } from "@/lib/db";

export { hashInvitation };
export const hashConvite = hashInvitation;

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
