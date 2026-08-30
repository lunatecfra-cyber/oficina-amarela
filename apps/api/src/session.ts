import { COOKIE_NAME, type UserSession, verifySessionToken } from "@oficina/auth/session";
import { getSessionRevocationCutoff } from "@oficina/db/session-revocation";
import type { Role } from "@oficina/domain/roles";
import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";

/**
 * Sessão na fronteira da API.
 *
 * Mesma semântica do getSession() do apps/web — cookie, assinatura, corte de
 * revogação e falha aberta em erro transitório de banco — sem os atalhos de
 * desenvolvimento que fabricam sessão. Em dev o login continua acontecendo por
 * /api/auth/dev-login, que grava um cookie de verdade, então o caminho normal
 * atende os dois casos e a API não ganha uma porta a mais.
 */
export async function readSession(c: Context): Promise<UserSession | null> {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session || typeof session.issuedAt !== "number") return null;

  try {
    const cutoffSeconds = await getSessionRevocationCutoff(session.id);
    if (cutoffSeconds === null) return null;
    if (session.issuedAt < cutoffSeconds) return null;
  } catch {
    // Erro transitório de banco: aceita a assinatura válida, como no apps/web.
  }

  return session;
}

type SessionMiddleware = MiddlewareHandler<{
  Variables: { session: UserSession; requestId: string };
}>;

function requireRoles(roles?: Role[], forbiddenMessage?: string): SessionMiddleware {
  return async (c, next) => {
    const session = await readSession(c);
    if (!session) return c.json({ error: "Faça login para continuar." }, 401);
    if (roles && !roles.includes(session.role)) {
      return c.json({ error: forbiddenMessage ?? "Você não pode fazer isso." }, 403);
    }
    c.set("session", session);
    await next();
  };
}

export const requireSession = requireRoles();

/** Exige sessão de editor (admin também passa, para inspeção). */
export const requireEditor = requireRoles(["editor", "admin"], "Só editores recebem missões.");

/** Exige sessão de porta-voz (admin também passa, para inspeção). */
export const requireSpokesperson = requireRoles(
  ["spokesperson", "admin"],
  "Só porta-vozes têm acesso a esta área.",
);

/**
 * Exige sessão de inspetor. Único portão da administração de convites: o papel
 * no banco só aceita 'voz', 'editor' e 'admin', então não há um "inspetor"
 * alternativo para acomodar aqui.
 */
export const requireAdmin = requireRoles(["admin"], "Só o inspetor pode fazer isso.");
