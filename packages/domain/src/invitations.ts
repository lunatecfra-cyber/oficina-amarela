import { createHash, randomBytes } from "node:crypto";

/**
 * Convite de porta-voz: o portão de legitimidade da conta oficial.
 *
 * Não existe um segundo estado de "aprovação de candidato" — o convite emitido
 * pelo inspetor é a própria autorização. Por isso token, hash e validade moram
 * aqui, no domínio, e não em uma das pontas: apps/api emite, apps/web resgata,
 * e os dois precisam concordar sobre o que torna um convite válido.
 */

export const INVITATION_VALIDITY_DAYS = 7;

/** Só o hash vai para o banco; o token em claro só existe na resposta da emissão. */
export function hashInvitation(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateInvitationToken() {
  return randomBytes(32).toString("hex");
}

/** Devolve o e-mail normalizado, ou null quando não é um endereço aceitável. */
export function normalizeInvitationEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}
