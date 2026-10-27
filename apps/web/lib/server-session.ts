import { COOKIE_NAME, type UserSession, verifySessionToken } from "@oficina/auth/session";
import { isDevAuthBypassEnabled } from "@oficina/config/dev-mode";
import { type Capability, hasCapability } from "@oficina/domain/roles";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchApi } from "./internal-api.ts";

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

  // Em desenvolvimento pode não haver banco (DATABASE_STUB=1), e os atalhos de
  // /api/auth/dev-login assinam tokens de contas sintéticas que nunca existiram
  // nele. Revalidar contra /auth/session aqui devolvia 401 e transformava todo
  // login local — inclusive os atalhos — numa volta para /login.
  if (isDevAuthBypassEnabled()) return session;

  try {
    const response = await fetchApi("/auth/session");
    return response.ok ? ((await response.json()) as UserSession) : null;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<UserSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireCapability(capability: Capability): Promise<UserSession> {
  const session = await requireSession();
  if (!hasCapability(session, capability))
    redirect(hasCapability(session, "mission.read") ? "/inspetor" : "/");
  return session;
}
