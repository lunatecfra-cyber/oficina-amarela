import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "confraria_sessao";
export const NOME_COOKIE = COOKIE_NAME; // compatibility alias
const DURATION = "30d";

export const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

function getKey() {
  const secret =
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === "development" && !process.env.VERCEL
      ? "yellow-workshop-local-dev-secret"
      : undefined);
  if (!secret) throw new Error("AUTH_SECRET not configured (.env.local)");
  return new TextEncoder().encode(secret);
}

export type Role = "spokesperson" | "editor" | "admin";
export type Papel = Role; // compatibility alias

export type UserSession = {
  id: number;
  handle: string;
  name: string;
  role: Role;
  issuedAt?: number;
  // compatibility aliases
  apelido?: string;
  nome?: string;
  papel?: Role;
  emitidoEm?: number;
};

export type SessaoUsuario = UserSession;

export async function createSessionToken(user: UserSession) {
  return new SignJWT({
    id: user.id,
    handle: user.handle,
    name: user.name,
    role: user.role,
    // also put aliases for compatibility
    apelido: user.handle,
    nome: user.name,
    papel: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(DURATION)
    .sign(getKey());
}

export const criarTokenSessao = createSessionToken;

export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, getKey());
    const handle = (payload.handle as string) || (payload.apelido as string);
    const name = (payload.name as string) || (payload.nome as string);
    const rawRole = (payload.role as string) || (payload.papel as string);
    const role: Role =
      rawRole === "voz" || rawRole === "spokesperson"
        ? "spokesperson"
        : rawRole === "admin"
          ? "admin"
          : "editor";

    if (typeof payload.id === "number" && handle && name) {
      const issuedAt = typeof payload.iat === "number" ? payload.iat : undefined;
      return {
        id: payload.id,
        handle,
        name,
        role,
        issuedAt,
        apelido: handle,
        nome: name,
        papel: role,
        emitidoEm: issuedAt,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export const verificarTokenSessao = verifySessionToken;

export const STATE_COOKIE_NAME = "confraria_oauth_estado";
export const NOME_COOKIE_ESTADO = STATE_COOKIE_NAME;

export const STATE_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 10,
};
export const COOKIE_ESTADO_OPTS = STATE_COOKIE_OPTS;

export async function createSignedState(nonce: string) {
  return new SignJWT({ usage: "oauth-state", uso: "oauth-estado", nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getKey());
}
export const criarEstadoAssinado = createSignedState;

export async function verifySignedState(
  token: string,
  cookieNonce: string | undefined
): Promise<boolean> {
  if (!cookieNonce) return false;
  try {
    const { payload } = await jwtVerify(token, getKey());
    const validUsage = payload.usage === "oauth-state" || payload.uso === "oauth-estado" || payload.usage === "oauth-estado" || payload.uso === "oauth-state";
    return validUsage && payload.nonce === cookieNonce;
  } catch {
    return false;
  }
}
export const verificarEstadoAssinado = verifySignedState;

export const PENDING_COOKIE_NAME = "confraria_google_pendente";
export const NOME_COOKIE_PENDENTE = PENDING_COOKIE_NAME;
export const INVITATION_COOKIE_NAME = "confraria_convite_porta_voz";
export const NOME_COOKIE_CONVITE = INVITATION_COOKIE_NAME;
export const REFERRAL_COOKIE_NAME = "confraria_indicacao_editor";
export const NOME_COOKIE_INDICACAO = REFERRAL_COOKIE_NAME;

export type PendingGoogleIdentity = {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  picture?: string;
  // aliases
  nome?: string;
  foto?: string;
};
export type IdentidadeGooglePendente = PendingGoogleIdentity;

export async function createPendingIdentity(data: PendingGoogleIdentity) {
  return new SignJWT({
    googleId: data.googleId,
    email: data.email,
    name: data.name || data.nome,
    avatarUrl: data.avatarUrl || data.foto,
    nome: data.name || data.nome,
    foto: data.avatarUrl || data.foto,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getKey());
}
export const criarIdentidadePendente = createPendingIdentity;

export async function verifyPendingIdentity(
  token: string
): Promise<PendingGoogleIdentity | null> {
  try {
    const { payload } = await jwtVerify(token, getKey());
    const name = (payload.name as string) || (payload.nome as string);
    const avatarUrl = (payload.avatarUrl as string) || (payload.foto as string);
    if (typeof payload.googleId === "string" && typeof payload.email === "string" && name) {
      return {
        googleId: payload.googleId,
        email: payload.email,
        name,
        avatarUrl,
        picture: avatarUrl,
        nome: name,
        foto: avatarUrl,
      };
    }
    return null;
  } catch {
    return null;
  }
}
export const verificarIdentidadePendente = verifyPendingIdentity;

export async function createRecoveryToken(userId: number) {
  return new SignJWT({ usage: "password-recovery", userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(getKey());
}
export const criarTokenRecuperacao = createRecoveryToken;

export async function verifyRecoveryToken(
  token: string
): Promise<{ userId: number; issuedAtMs: number } | null> {
  try {
    const { payload } = await jwtVerify(token, getKey());
    if (
      (payload.usage === "password-recovery" || payload.uso === "recuperar-senha") &&
      typeof payload.userId === "number" &&
      typeof payload.iat === "number"
    ) {
      return { userId: payload.userId, issuedAtMs: payload.iat * 1000 };
    }
    return null;
  } catch {
    return null;
  }
}
export const verificarTokenRecuperacao = verifyRecoveryToken;
