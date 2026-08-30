import { COOKIE_NAME, type UserSession, verifySessionToken } from "@oficina/auth/session";
import { isDevAuthBypassEnabled } from "@oficina/config/dev-mode";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function getSession(): Promise<UserSession | null> {
  const jar = await cookies();

  if (isDevAuthBypassEnabled() && jar.get("dev_god_mode")?.value === "true") {
    return {
      id: 9999,
      name: "God Mode",
      handle: "god.mode",
      role: "admin",
      issuedAt: Math.floor(Date.now() / 1000),
      nome: "God Mode",
      apelido: "god.mode",
      papel: "admin",
      emitidoEm: Math.floor(Date.now() / 1000),
    };
  }

  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) {
    if (isDevAuthBypassEnabled()) {
      return {
        id: 1,
        name: "Dev Admin",
        handle: "dev.admin",
        role: "admin",
        issuedAt: Math.floor(Date.now() / 1000),
        nome: "Dev Admin",
        apelido: "dev.admin",
        papel: "admin",
        emitidoEm: Math.floor(Date.now() / 1000),
      };
    }
    return null;
  }

  const session = await verifySessionToken(token);
  if (!session) return null;
  if (typeof session.issuedAt !== "number") return null;

  return session;
}

export const lerSessao = getSession;

export async function requireSession(): Promise<UserSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export const exigirSessao = requireSession;
export const readSession = getSession;
export const getServerSession = getSession;
