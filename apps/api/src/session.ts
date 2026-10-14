import { COOKIE_NAME, type UserSession, verifySessionToken } from "@oficina/auth/session";
import type { AccountsRepository } from "@oficina/db/accounts";
import type { D1DatabaseLike } from "@oficina/db/d1/types";
import {
  type Capability,
  hasCapability,
  ROLE_CAPABILITIES,
  type Role,
} from "@oficina/domain/roles";
import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";

/** Sessão e capacidades revalidadas na conta atual; indisponibilidade falha fechada. */
export async function readSession(c: Context): Promise<UserSession | null> {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session || typeof session.issuedAt !== "number") return null;

  try {
    const accounts = c.get("accounts") as AccountsRepository;
    const account = await accounts.findById(session.id);
    if (
      !account ||
      account.banned ||
      account.role !== session.role ||
      account.sessionVersion !== (session.sessionVersion ?? 0)
    )
      return null;
    session.name = account.name;
    session.handle = account.handle;
    if (c.env?.DB) {
      const { results } = await (c.env.DB as D1DatabaseLike)
        .prepare("SELECT capability FROM authorized_user_capabilities WHERE user_id=?")
        .bind(session.id)
        .all<{ capability: Capability }>();
      session.capabilities = results.map((row) => row.capability);
    } else session.capabilities = [...ROLE_CAPABILITIES[account.role]];
    const cutoffSeconds = Math.floor((account.sessionCutoffMs ?? 0) / 1000);
    // Tolerância de 2s para desvios de relógio de subsegundo na criação de conta/sessão.
    if (session.issuedAt < cutoffSeconds - 2) return null;
  } catch {
    return null;
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
    if (
      roles &&
      (!roles.includes(session.role) ||
        (session.role === "admin" && !hasCapability(session, "mission.participate")))
    ) {
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

/** Capacidades vêm da conta atual, nunca dos claims de privilégio do JWT. */
export function requireCapability(capability: Capability): SessionMiddleware {
  return async (c, next) => {
    const session = await readSession(c);
    if (!session) return c.json({ error: "Faça login para continuar." }, 401);
    if (!hasCapability(session, capability))
      return c.json({ error: "Você não tem permissão para esta operação." }, 403);
    c.set("session", session);
    c.header("cache-control", "private, no-store");
    await next();
  };
}

export const requireInspector = requireCapability("mission.inspect");
