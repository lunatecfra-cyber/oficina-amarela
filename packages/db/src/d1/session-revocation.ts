import type { SessionRevocationSource } from "../session-revocation.ts";
import type { D1DatabaseLike } from "./types.ts";

/**
 * Paridade D1 do corte de revogação de sessão.
 *
 * Mesmo contrato do PostgreSQL: segundos-epoch a partir dos quais a sessão vale,
 * ou null quando o usuário não existe mais — que é o que faz o middleware
 * recusar a sessão de quem foi apagado.
 */
export function createD1SessionRevocationSource(db: D1DatabaseLike): SessionRevocationSource {
  return async (userId) => {
    const row = await db
      .prepare("SELECT sessoes_validas_apos FROM users WHERE id = ?")
      .bind(userId)
      .first<{ sessoes_validas_apos: string }>();
    return row ? Math.floor(new Date(row.sessoes_validas_apos).getTime() / 1000) : null;
  };
}
