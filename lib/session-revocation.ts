import { sql } from "@/lib/db";

/**
 * Cache curto do corte de revogação de sessão.
 *
 * getSession() valida o JWT e depois confere `users.sessoes_validas_apos` para
 * respeitar banimento, troca de senha e "sair de todos os aparelhos". Essa
 * conferência acontecia em toda requisição autenticada — página, API, tudo —
 * para um valor que quase nunca muda. Com 5.000 usuários simultâneos isso
 * sozinho são milhares de leituras por segundo.
 *
 * O cache é por processo (por isolate, nos Workers), então a revogação demora
 * no máximo REVOCATION_TTL_MS para alcançar instâncias que não fizeram a
 * escrita. É uma escolha explícita, não um descuido: quem revoga invalida a
 * própria entrada na hora, e a janela residual é a mesma ordem de grandeza que
 * qualquer propagação entre instâncias.
 */
export const REVOCATION_TTL_MS = 30_000;

/** Acima disso o mapa é esvaziado inteiro. */
// ponytail: limpeza total em vez de LRU; se a taxa de acerto cair, medir antes de trocar.
const MAX_ENTRIES = 10_000;

/** `null` = usuário não existe mais. */
type Entry = { cutoffSeconds: number | null; expiresAt: number };

const cache = new Map<number, Entry>();

export function invalidateSessionRevocation(userId: number): void {
  cache.delete(userId);
}

/** Só para testes: zera o cache inteiro. */
export function clearSessionRevocationCache(): void {
  cache.clear();
}

/**
 * Segundos-epoch a partir dos quais uma sessão é válida, ou `null` quando o
 * usuário não existe. Lança quando o banco falha — quem chama decide.
 */
export async function getSessionRevocationCutoff(userId: number): Promise<number | null> {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.cutoffSeconds;

  const [row] = await sql`
    SELECT sessoes_validas_apos FROM users WHERE id = ${userId}
  `;

  const cutoffSeconds = row
    ? Math.floor(new Date(row.sessoes_validas_apos).getTime() / 1000)
    : null;

  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(userId, { cutoffSeconds, expiresAt: Date.now() + REVOCATION_TTL_MS });

  return cutoffSeconds;
}
