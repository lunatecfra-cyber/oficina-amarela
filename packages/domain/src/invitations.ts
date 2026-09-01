/**
 * Convite de porta-voz: o portão de legitimidade da conta oficial.
 *
 * Não existe um segundo estado de "aprovação de candidato" — o convite emitido
 * pelo inspetor é a própria autorização. Por isso token, hash e validade moram
 * aqui, no domínio, e não em uma das pontas: apps/api emite, apps/web resgata,
 * e os dois precisam concordar sobre o que torna um convite válido.
 *
 * O hash e o sorteio do token saem da Web Crypto, e não de `node:crypto`: o
 * domínio é importado pelo Worker da API, pelo Next e pela instrumentação Edge,
 * e só a Web Crypto existe nos três. Com o builtin do Node, o bundle Edge
 * puxava `node:crypto` por esta linha e avisava em toda requisição.
 */

export const INVITATION_VALIDITY_DAYS = 7;

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/**
 * Só o hash vai para o banco; o token em claro só existe na resposta da emissão.
 *
 * É assíncrona porque `crypto.subtle.digest` é — não há versão síncrona de
 * SHA-256 na Web Crypto, e inventar uma à mão num caminho de autorização não
 * está em discussão.
 */
export async function hashInvitation(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

export function generateInvitationToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

/** Devolve o e-mail normalizado, ou null quando não é um endereço aceitável. */
export function normalizeInvitationEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}
