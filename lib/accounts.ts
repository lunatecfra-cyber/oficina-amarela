import bcrypt from "bcryptjs";
import { LIMITS, SLOTS, limitStr } from "@/lib/limits";
import { sql } from "@/lib/db";
import type { Role } from "@/lib/session";

import { validateSpokespersonInvitation } from "@/lib/invitations-db";

export type UserAccount = {
  id: number;
  handle: string;
  name: string;
  email: string;
  role: Role;
  // aliases
  apelido?: string;
  nome?: string;
  papel?: Role;
};

export type ContaUsuario = UserAccount;

const RE_HANDLE = /^[a-z0-9._]{3,24}$/i;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validReferralCode(code?: string) {
  return code && RE_UUID.test(code) ? code : null;
}

const DUMMY_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export function isValidHandle(handle: string) {
  return RE_HANDLE.test(handle.trim());
}

export const apelidoValido = isValidHandle;

type AccountFailure = {
  ok: false;
  error: string;
  isConflict: boolean;
  conflict?: boolean;
  erro?: string;
  conflito?: boolean;
};

export async function createAccount(data: {
  name: string;
  handle: string;
  email: string;
  password: string;
  role: Role;
  invitation?: string;
  convite?: string;
  referralCode?: string;
  codigoIndicacao?: string;
}): Promise<{ ok: true; account: UserAccount; conta?: UserAccount } | AccountFailure> {
  const name = limitStr(data.name, LIMITS.name);
  const handle = limitStr(data.handle, LIMITS.handle);
  const email = limitStr(data.email, LIMITS.email);
  const invitation = data.invitation ?? data.convite;
  const referralCode = validReferralCode(data.referralCode ?? data.codigoIndicacao);

  if (!name) return { ok: false, error: "Digite seu nome.", isConflict: false, conflict: false, erro: "Digite seu nome.", conflito: false };
  if (data.password.length > 200) {
    return { ok: false, error: "Senha longa demais.", isConflict: false, conflict: false, erro: "Senha longa demais.", conflito: false };
  }
  if (!isValidHandle(handle)) {
    return {
      ok: false,
      error: "Apelido deve ter 3-24 letras, números, ponto ou underline.",
      isConflict: false,
      conflict: false,
      erro: "Apelido deve ter 3-24 letras, números, ponto ou underline.",
      conflito: false,
    };
  }
  if (!RE_EMAIL.test(email)) {
    return { ok: false, error: "Digite um e-mail válido.", isConflict: false, conflict: false, erro: "Digite um e-mail válido.", conflito: false };
  }
  if (data.password.length < 6) {
    return { ok: false, error: "Senha precisa de pelo menos 6 caracteres.", isConflict: false, conflict: false, erro: "Senha precisa de pelo menos 6 caracteres.", conflito: false };
  }

  const [handleInUse] = await sql`SELECT id FROM users WHERE lower(handle) = lower(${handle})`;
  if (handleInUse) {
    return { ok: false, error: "Esse apelido já está em uso.", isConflict: true, conflict: true, erro: "Esse apelido já está em uso.", conflito: true };
  }

  const [emailInUse] = await sql`SELECT id FROM users WHERE lower(email) = lower(${email})`;
  if (emailInUse) {
    return { ok: false, error: "Esse e-mail já está cadastrado.", isConflict: true, conflict: true, erro: "Esse e-mail já está cadastrado.", conflito: true };
  }

  const password_hash = await bcrypt.hash(data.password, 10);

  if (data.role === "spokesperson" || (data.role as string) === "voz") {
    const validInvite = await validateSpokespersonInvitation(invitation ?? "", email);
    if (!validInvite.ok) {
      return { ok: false, error: validInvite.error, isConflict: false, conflict: false, erro: validInvite.error, conflito: false };
    }
    try {
      const [row] = await sql`
        SELECT id FROM oficina_private.criar_porta_voz_com_convite(
          ${validInvite.tokenHash}, ${email}, ${handle}, ${name}, ${password_hash},
          ${null}, ${null}, ${referralCode}::uuid
        )
      `;
      const account: UserAccount = {
        id: row.id,
        handle,
        name,
        email,
        role: data.role,
        apelido: handle,
        nome: name,
        papel: data.role,
      };
      return { ok: true, account, conta: account };
    } catch {
      return { ok: false, error: "Convite inválido, expirado ou já utilizado.", isConflict: false, conflict: false, erro: "Convite inválido, expirado ou já utilizado.", conflito: false };
    }
  }

  const [row] = await sql`
    INSERT INTO users (handle, name, email, password_hash, role, indicated_by_id)
    VALUES (${handle}, ${name}, ${email}, ${password_hash}, ${data.role},
            (SELECT id FROM users WHERE referral_code = ${referralCode}::uuid OR codigo_indicacao = ${referralCode}::uuid))
    RETURNING id
  `;

  const account: UserAccount = {
    id: row.id,
    handle,
    name,
    email,
    role: data.role,
    apelido: handle,
    nome: name,
    papel: data.role,
  };

  return { ok: true, account, conta: account };
}

export const criarConta = createAccount;

export async function authenticate(
  handle: string,
  password: string
): Promise<{ ok: true; account: UserAccount; conta?: UserAccount } | { ok: false; error: string; erro?: string }> {
  const [row] = await sql`
    SELECT id, handle, name, email, role, password_hash, is_banned
    FROM users
    WHERE lower(handle) = lower(${handle.trim()})
  `;

  const hash = row?.password_hash ?? DUMMY_HASH;
  const passwordMatches = await bcrypt.compare(password, hash);

  if (!row || !row.password_hash || !passwordMatches) {
    return { ok: false, error: "Incorrect username or password.", erro: "Incorrect username or password." };
  }

  if (row.is_banned) {
    return { ok: false, error: "Account suspended. Please contact quality control / inspector.", erro: "Account suspended." };
  }

  const account: UserAccount = {
    id: row.id,
    handle: row.handle,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    apelido: row.handle,
    nome: row.name,
    papel: row.role as Role,
  };

  return { ok: true, account, conta: account };
}

export const autenticar = authenticate;

export async function findGoogleAccount(
  googleId: string,
  email: string
): Promise<{ ok: true; account: UserAccount | null; conta?: UserAccount | null } | { ok: false; error: string; erro?: string }> {
  const [byGoogleId] = await sql`
    SELECT id, handle, name, email, role, is_banned FROM users WHERE google_id = ${googleId}
  `;
  if (byGoogleId) {
    if (byGoogleId.is_banned) {
      return { ok: false, error: "Account suspended. Please contact quality control.", erro: "Account suspended." };
    }
    const acc: UserAccount = {
      id: byGoogleId.id,
      handle: byGoogleId.handle,
      name: byGoogleId.name,
      email: byGoogleId.email,
      role: byGoogleId.role as Role,
      apelido: byGoogleId.handle,
      nome: byGoogleId.name,
      papel: byGoogleId.role as Role,
    };
    return { ok: true, account: acc, conta: acc };
  }

  const [linked] = await sql`
    UPDATE users
    SET google_id = ${googleId}
    WHERE lower(email) = lower(${email}) AND google_id IS NULL AND is_banned = false
    RETURNING id, handle, name, email, role
  `;
  if (linked) {
    const acc: UserAccount = {
      id: linked.id,
      handle: linked.handle,
      name: linked.name,
      email: linked.email,
      role: linked.role as Role,
      apelido: linked.handle,
      nome: linked.name,
      papel: linked.role as Role,
    };
    return { ok: true, account: acc, conta: acc };
  }

  const [bannedByEmail] = await sql`
    SELECT id FROM users WHERE lower(email) = lower(${email}) AND is_banned = true
  `;
  if (bannedByEmail) {
    return { ok: false, error: "Account suspended. Please contact quality control.", erro: "Account suspended." };
  }

  const [byEmail] = await sql`SELECT id FROM users WHERE lower(email) = lower(${email})`;
  if (byEmail) {
    return { ok: false, error: "This email is already linked to another Google account.", erro: "This email is already linked." };
  }

  return { ok: true, account: null, conta: null };
}

export const buscarContaGoogle = findGoogleAccount;

export async function createGoogleAccount(data: {
  googleId: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string;
  foto?: string;
  invitation?: string;
  convite?: string;
  referralCode?: string;
  codigoIndicacao?: string;
}): Promise<{ ok: true; account: UserAccount; conta?: UserAccount } | { ok: false; error: string; erro?: string }> {
  const handle = await generateUniqueHandle(data.email);
  const avatar = data.avatarUrl ?? data.foto ?? null;
  const invitation = data.invitation ?? data.convite;
  const referralCode = validReferralCode(data.referralCode ?? data.codigoIndicacao);

  if (data.role === "spokesperson" || (data.role as string) === "voz") {
    const validInvite = await validateSpokespersonInvitation(invitation ?? "", data.email);
    if (!validInvite.ok) return validInvite;
    try {
      const [row] = await sql`
        SELECT id FROM oficina_private.criar_porta_voz_com_convite(
          ${validInvite.tokenHash}, ${data.email}, ${handle}, ${data.name}, ${null},
          ${data.googleId}, ${avatar}, ${referralCode}::uuid
        )
      `;
      const account: UserAccount = {
        id: row.id,
        handle,
        name: data.name,
        email: data.email,
        role: data.role,
        apelido: handle,
        nome: data.name,
        papel: data.role,
      };
      return { ok: true, account, conta: account };
    } catch {
      return { ok: false, error: "Convite inválido, expirado ou já utilizado.", erro: "Convite inválido, expirado ou já utilizado." };
    }
  }

  const [row] = await sql`
    INSERT INTO users (handle, name, email, google_id, role, avatar_url, indicated_by_id)
    VALUES (${handle}, ${data.name}, ${data.email}, ${data.googleId}, ${data.role}, ${avatar},
            (SELECT id FROM users WHERE referral_code = ${referralCode}::uuid OR codigo_indicacao = ${referralCode}::uuid))
    RETURNING id
  `;

  const account: UserAccount = {
    id: row.id,
    handle,
    name: data.name,
    email: data.email,
    role: data.role,
    apelido: handle,
    nome: data.name,
    papel: data.role,
  };

  return { ok: true, account, conta: account };
}

export const criarContaGoogle = createGoogleAccount;

export async function findAccountByEmail(email: string): Promise<UserAccount | null> {
  const [row] = await sql`
    SELECT id, handle, name, email, role FROM users WHERE lower(email) = lower(${email.trim()})
  `;
  if (!row) return null;
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    apelido: row.handle,
    nome: row.name,
    papel: row.role as Role,
  };
}

export const buscarContaPorEmail = findAccountByEmail;

export async function accountHasPassword(userId: number): Promise<boolean> {
  const [row] = await sql`SELECT password_hash FROM users WHERE id = ${userId}`;
  return !!row?.password_hash;
}

export const contaTemSenha = accountHasPassword;

export async function deleteAccount(
  userId: number,
  confirmation: string
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const [row] = await sql`
    SELECT handle, password_hash FROM users WHERE id = ${userId}
  `;
  if (!row) return { ok: false, error: "Account not found.", erro: "Account not found." };

  const matches = row.password_hash
    ? await bcrypt.compare(confirmation, row.password_hash)
    : confirmation.trim().toLowerCase() === String(row.handle).toLowerCase();

  if (!matches) {
    const err = row.password_hash
      ? "Incorrect password."
      : "Please type your username exactly as it appears.";
    return { ok: false, error: err, erro: err };
  }

  // Release any active reserved missions back to the queue
  await sql`
    UPDATE missions
    SET status = 'available', reserved_by_id = NULL, reserved_at = NULL
    WHERE reserved_by_id = ${userId} AND status IN ('reserved','revision_requested','offered')
  `;

  await sql`DELETE FROM users WHERE id = ${userId}`;
  return { ok: true };
}

export const apagarConta = deleteAccount;

export async function isRecoveryLinkUsed(
  userId: number,
  issuedAtMs: number
): Promise<boolean> {
  const [row] = await sql`
    SELECT valid_sessions_after FROM users WHERE id = ${userId}
  `;
  if (!row?.valid_sessions_after) return false;
  return issuedAtMs < new Date(row.valid_sessions_after).getTime();
}

export const linkRecuperacaoJaUsado = isRecoveryLinkUsed;
export const isRecoveryTokenAlreadyUsed = isRecoveryLinkUsed;

export async function updatePassword(
  userId: number,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  if (newPassword.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters.", erro: "Password must be at least 6 characters." };
  }
  const password_hash = await bcrypt.hash(newPassword, 10);
  await sql`
    UPDATE users
    SET password_hash = ${password_hash}, valid_sessions_after = now()
    WHERE id = ${userId}
  `;
  return { ok: true };
}

export const updateAccountPassword = updatePassword;
export const atualizarSenha = updatePassword;

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const WINDOW_MINUTES = 15;

export async function isRateLocked(
  rawKey: string
): Promise<{ locked: boolean; minutes: number; travado?: boolean; minutos?: number }> {
  const key = rawKey.trim().toLowerCase();
  const [row] = await sql`SELECT locked_until FROM login_attempts WHERE key = ${key}`;
  if (!row?.locked_until) return { locked: false, minutes: 0, travado: false, minutos: 0 };

  const remainingMs = new Date(row.locked_until).getTime() - Date.now();
  if (remainingMs <= 0) return { locked: false, minutes: 0, travado: false, minutos: 0 };

  const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return { locked: true, minutes, travado: true, minutos: minutes };
}

export const taxaTravada = isRateLocked;

export async function recordAttempt(
  rawKey: string,
  max = MAX_ATTEMPTS
): Promise<void> {
  const key = rawKey.trim().toLowerCase();

  const [row] = await sql`
    INSERT INTO login_attempts (key, attempts, first_at)
    VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE
        WHEN login_attempts.first_at < now() - (${WINDOW_MINUTES} || ' minutes')::interval
          THEN 1
        ELSE login_attempts.attempts + 1
      END,
      first_at = CASE
        WHEN login_attempts.first_at < now() - (${WINDOW_MINUTES} || ' minutes')::interval
          THEN now()
        ELSE login_attempts.first_at
      END
    RETURNING attempts
  `;

  if (row && row.attempts >= max) {
    await sql`
      UPDATE login_attempts
      SET locked_until = now() + (${LOCK_MINUTES} || ' minutes')::interval,
          attempts = 0,
          first_at = now()
      WHERE key = ${key}
    `;
  }
}

export const isRateLimited = isRateLocked;
export const isLoginLocked = (handle: string) => isRateLocked(`login:${handle}`);
export const recordLoginFailure = (handle: string) => recordAttempt(`login:${handle}`);

export const loginTravado = isLoginLocked;
export const registrarFalhaLogin = recordLoginFailure;

const MAX_LOGINS_PER_IP = 30;

export const isIpLoginLocked = (ip: string) => isRateLocked(`loginip:${ip}`);
export const isLoginLockedByIp = isIpLoginLocked;
export const recordIpLoginFailure = (ip: string) => recordAttempt(`loginip:${ip}`, MAX_LOGINS_PER_IP);
export const recordLoginFailureByIp = recordIpLoginFailure;

export const loginTravadoPorIp = isIpLoginLocked;
export const registrarFalhaLoginIp = recordIpLoginFailure;

export async function clearLoginAttempts(handle: string): Promise<void> {
  await sql`DELETE FROM login_attempts WHERE key = ${`login:${handle}`.trim().toLowerCase()}`;
}

export const limparTentativasLogin = clearLoginAttempts;

export async function countEnrolled(role: Role): Promise<number> {
  const [row] = await sql`SELECT count(*)::int AS n FROM users WHERE role = ${role}`;
  return Number(row?.n ?? 0);
}

export const countEnrolledByRole = countEnrolled;
export const contarInscritos = countEnrolled;

export async function checkRoleSlots(
  role: Role
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const max = SLOTS[role as keyof typeof SLOTS];
  if (max === undefined) return { ok: true };

  const total = await countEnrolled(role);
  if (total >= max) {
    const label = role === "editor" ? "editors" : "spokespersons";
    const msg = `Capacity reached: we have hit the limit of ${max} ${label}. Please try again later.`;
    return { ok: false, error: msg, erro: msg };
  }
  return { ok: true };
}

export const checarVagaPapel = checkRoleSlots;

async function generateUniqueHandle(email: string): Promise<string> {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 20) || "user";
  let handle = base;

  for (let n = 1; n <= 50; n++) {
    const [existing] = await sql`SELECT id FROM users WHERE lower(handle) = lower(${handle})`;
    if (!existing) return handle;
    handle = `${base}${n + 1}`;
  }

  return `${base.slice(0, 12)}${Math.random().toString(36).slice(2, 8)}`;
}

export const authenticateUser = authenticate;
export const isLoginLockedByHandle = isLoginLocked;
