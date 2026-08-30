import { invalidateSessionRevocation } from "@oficina/db/session-revocation";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { validateSpokespersonInvitation } from "@/lib/invitations-db";
import { LIMITS, limitStr, SLOTS } from "@/lib/limits";
import type { Role } from "@/lib/session";

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

function normalizeRoleToDb(role: string): string {
  return role === "spokesperson" ? "voz" : role;
}

function normalizeRoleFromDb(papel: string): Role {
  if (papel === "voz" || papel === "spokesperson") return "spokesperson";
  if (papel === "admin") return "admin";
  return "editor";
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
  const dbPapel = normalizeRoleToDb(data.role);

  if (!name)
    return {
      ok: false,
      error: "Digite seu nome.",
      isConflict: false,
      conflict: false,
      erro: "Digite seu nome.",
      conflito: false,
    };
  if (data.password.length > 200) {
    return {
      ok: false,
      error: "Senha longa demais.",
      isConflict: false,
      conflict: false,
      erro: "Senha longa demais.",
      conflito: false,
    };
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
    return {
      ok: false,
      error: "Digite um e-mail válido.",
      isConflict: false,
      conflict: false,
      erro: "Digite um e-mail válido.",
      conflito: false,
    };
  }
  if (data.password.length < 6) {
    return {
      ok: false,
      error: "Senha precisa de pelo menos 6 caracteres.",
      isConflict: false,
      conflict: false,
      erro: "Senha precisa de pelo menos 6 caracteres.",
      conflito: false,
    };
  }

  const [handleInUse] = await sql`SELECT id FROM users WHERE lower(apelido) = lower(${handle})`;
  if (handleInUse) {
    return {
      ok: false,
      error: "Esse apelido já está em uso.",
      isConflict: true,
      conflict: true,
      erro: "Esse apelido já está em uso.",
      conflito: true,
    };
  }

  const [emailInUse] = await sql`SELECT id FROM users WHERE lower(email) = lower(${email})`;
  if (emailInUse) {
    return {
      ok: false,
      error: "Esse e-mail já está cadastrado.",
      isConflict: true,
      conflict: true,
      erro: "Esse e-mail já está cadastrado.",
      conflito: true,
    };
  }

  const password_hash = await bcrypt.hash(data.password, 10);

  if (data.role === "spokesperson" || (data.role as string) === "voz") {
    const validInvite = await validateSpokespersonInvitation(invitation ?? "", email);
    if (!validInvite.ok) {
      return {
        ok: false,
        error: validInvite.error,
        isConflict: false,
        conflict: false,
        erro: validInvite.error,
        conflito: false,
      };
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
      return {
        ok: false,
        error: "Convite inválido, expirado ou já utilizado.",
        isConflict: false,
        conflict: false,
        erro: "Convite inválido, expirado ou já utilizado.",
        conflito: false,
      };
    }
  }

  const [row] = await sql`
    INSERT INTO users (apelido, nome, email, senha_hash, papel, indicado_por_id)
    VALUES (${handle}, ${name}, ${email}, ${password_hash}, ${dbPapel},
            (SELECT id FROM users WHERE codigo_indicacao = ${referralCode}::uuid))
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
  password: string,
): Promise<
  | { ok: true; account: UserAccount; conta?: UserAccount }
  | { ok: false; error: string; erro?: string }
> {
  const [row] = await sql`
    SELECT id, apelido, nome, email, papel, senha_hash, banido
    FROM users
    WHERE lower(apelido) = lower(${handle.trim()})
  `;

  const hash = row?.senha_hash ?? DUMMY_HASH;
  const passwordMatches = await bcrypt.compare(password, hash);

  if (!row?.senha_hash || !passwordMatches) {
    return {
      ok: false,
      error: "Apelido ou senha incorretos.",
      erro: "Apelido ou senha incorretos.",
    };
  }

  if (row.banido) {
    return {
      ok: false,
      error: "Conta suspensa. Fale com a fiscalização.",
      erro: "Conta suspensa. Fale com a fiscalização.",
    };
  }

  const role = normalizeRoleFromDb(row.papel);
  const account: UserAccount = {
    id: row.id,
    handle: row.apelido,
    name: row.nome,
    email: row.email,
    role,
    apelido: row.apelido,
    nome: row.nome,
    papel: role,
  };

  return { ok: true, account, conta: account };
}

export const autenticar = authenticate;

export async function findGoogleAccount(
  googleId: string,
  email: string,
): Promise<
  | { ok: true; account: UserAccount | null; conta?: UserAccount | null }
  | { ok: false; error: string; erro?: string }
> {
  const [byGoogleId] = await sql`
    SELECT id, apelido, nome, email, papel, banido FROM users WHERE google_id = ${googleId}
  `;
  if (byGoogleId) {
    if (byGoogleId.banido) {
      return {
        ok: false,
        error: "Conta suspensa. Fale com a fiscalização.",
        erro: "Conta suspensa. Fale com a fiscalização.",
      };
    }
    const role = normalizeRoleFromDb(byGoogleId.papel);
    const acc: UserAccount = {
      id: byGoogleId.id,
      handle: byGoogleId.apelido,
      name: byGoogleId.nome,
      email: byGoogleId.email,
      role,
      apelido: byGoogleId.apelido,
      nome: byGoogleId.nome,
      papel: role,
    };
    return { ok: true, account: acc, conta: acc };
  }

  const [linked] = await sql`
    UPDATE users
    SET google_id = ${googleId}
    WHERE lower(email) = lower(${email}) AND google_id IS NULL AND banido = false
    RETURNING id, apelido, nome, email, papel
  `;
  if (linked) {
    const role = normalizeRoleFromDb(linked.papel);
    const acc: UserAccount = {
      id: linked.id,
      handle: linked.apelido,
      name: linked.nome,
      email: linked.email,
      role,
      apelido: linked.apelido,
      nome: linked.nome,
      papel: role,
    };
    return { ok: true, account: acc, conta: acc };
  }

  const [bannedByEmail] = await sql`
    SELECT id FROM users WHERE lower(email) = lower(${email}) AND banido = true
  `;
  if (bannedByEmail) {
    return {
      ok: false,
      error: "Conta suspensa. Fale com a fiscalização.",
      erro: "Conta suspensa. Fale com a fiscalização.",
    };
  }

  const [byEmail] = await sql`SELECT id FROM users WHERE lower(email) = lower(${email})`;
  if (byEmail) {
    return {
      ok: false,
      error: "Este e-mail já está vinculado a outra conta.",
      erro: "Este e-mail já está vinculado a outra conta.",
    };
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
}): Promise<
  | { ok: true; account: UserAccount; conta?: UserAccount }
  | { ok: false; error: string; erro?: string }
> {
  const handle = await generateUniqueHandle(data.email);
  const avatar = data.avatarUrl ?? data.foto ?? null;
  const invitation = data.invitation ?? data.convite;
  const referralCode = validReferralCode(data.referralCode ?? data.codigoIndicacao);
  const dbPapel = normalizeRoleToDb(data.role);

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
      return {
        ok: false,
        error: "Convite inválido, expirado ou já utilizado.",
        erro: "Convite inválido, expirado ou já utilizado.",
      };
    }
  }

  const [row] = await sql`
    INSERT INTO users (apelido, nome, email, google_id, papel, foto_url, indicado_por_id)
    VALUES (${handle}, ${data.name}, ${data.email}, ${data.googleId}, ${dbPapel}, ${avatar},
            (SELECT id FROM users WHERE codigo_indicacao = ${referralCode}::uuid))
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
    SELECT id, apelido, nome, email, papel FROM users WHERE lower(email) = lower(${email.trim()})
  `;
  if (!row) return null;
  const role = normalizeRoleFromDb(row.papel);
  return {
    id: row.id,
    handle: row.apelido,
    name: row.nome,
    email: row.email,
    role,
    apelido: row.apelido,
    nome: row.nome,
    papel: role,
  };
}

export const buscarContaPorEmail = findAccountByEmail;

export async function accountHasPassword(userId: number): Promise<boolean> {
  const [row] = await sql`SELECT senha_hash FROM users WHERE id = ${userId}`;
  return !!row?.senha_hash;
}

export const contaTemSenha = accountHasPassword;

export async function deleteAccount(
  userId: number,
  confirmation: string,
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const [row] = await sql`
    SELECT apelido, senha_hash FROM users WHERE id = ${userId}
  `;
  if (!row) return { ok: false, error: "Conta não encontrada.", erro: "Conta não encontrada." };

  const matches = row.senha_hash
    ? await bcrypt.compare(confirmation, row.senha_hash)
    : confirmation.trim().toLowerCase() === String(row.apelido).toLowerCase();

  if (!matches) {
    const err = row.senha_hash
      ? "Senha incorreta."
      : "Digite seu apelido exatamente como ele aparece.";
    return { ok: false, error: err, erro: err };
  }

  // Release any active reserved missions back to the queue
  await sql`
    UPDATE pautas
    SET status = 'disponivel', reservada_por_id = NULL, reservada_ate = NULL, reservada_em = NULL
    WHERE reservada_por_id = ${userId} AND status IN ('reservada','reedicao','oferecida')
  `;

  await sql`DELETE FROM users WHERE id = ${userId}`;
  invalidateSessionRevocation(userId);
  return { ok: true };
}

export const apagarConta = deleteAccount;

export async function isRecoveryLinkUsed(userId: number, issuedAtMs: number): Promise<boolean> {
  const [row] = await sql`
    SELECT sessoes_validas_apos FROM users WHERE id = ${userId}
  `;
  if (!row?.sessoes_validas_apos) return false;
  return issuedAtMs < new Date(row.sessoes_validas_apos).getTime();
}

export const linkRecuperacaoJaUsado = isRecoveryLinkUsed;
export const isRecoveryTokenAlreadyUsed = isRecoveryLinkUsed;

export async function updatePassword(
  userId: number,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  if (newPassword.length < 6) {
    return {
      ok: false,
      error: "Senha precisa de pelo menos 6 caracteres.",
      erro: "Senha precisa de pelo menos 6 caracteres.",
    };
  }
  const senha_hash = await bcrypt.hash(newPassword, 10);
  await sql`
    UPDATE users
    SET senha_hash = ${senha_hash}, sessoes_validas_apos = now()
    WHERE id = ${userId}
  `;
  invalidateSessionRevocation(userId);
  return { ok: true };
}

export const updateAccountPassword = updatePassword;
export const atualizarSenha = updatePassword;

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const WINDOW_MINUTES = 15;

export async function isRateLocked(
  rawKey: string,
): Promise<{ locked: boolean; minutes: number; travado?: boolean; minutos?: number }> {
  const key = rawKey.trim().toLowerCase();
  const [row] = await sql`SELECT travado_ate FROM tentativas_login WHERE chave = ${key}`;
  if (!row?.travado_ate) return { locked: false, minutes: 0, travado: false, minutos: 0 };

  const remainingMs = new Date(row.travado_ate).getTime() - Date.now();
  if (remainingMs <= 0) return { locked: false, minutes: 0, travado: false, minutos: 0 };

  const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return { locked: true, minutes, travado: true, minutos: minutes };
}

export const taxaTravada = isRateLocked;

/**
 * Conta uma tentativa e tranca a chave ao atingir `max` dentro da janela.
 *
 * Vale para qualquer chave, não só login: recuperação de senha, cadastro por
 * IP e emissão de URL de upload usam a mesma tabela. Como o estado mora no
 * banco, o limite vale entre instâncias — contador em memória de processo
 * desaparece assim que existe mais de um isolate.
 */
export async function recordAttempt(
  rawKey: string,
  max = MAX_ATTEMPTS,
  windowMinutes = WINDOW_MINUTES,
  lockMinutes = LOCK_MINUTES,
): Promise<{ locked: boolean }> {
  const key = rawKey.trim().toLowerCase();

  const [row] = await sql`
    INSERT INTO tentativas_login (chave, tentativas, primeira_em)
    VALUES (${key}, 1, now())
    ON CONFLICT (chave) DO UPDATE SET
      tentativas = CASE
        WHEN tentativas_login.primeira_em < now() - make_interval(mins => ${windowMinutes})
          THEN 1
        ELSE tentativas_login.tentativas + 1
      END,
      primeira_em = CASE
        WHEN tentativas_login.primeira_em < now() - make_interval(mins => ${windowMinutes})
          THEN now()
        ELSE tentativas_login.primeira_em
      END
    RETURNING tentativas
  `;

  // A coluna se chama `tentativas`. Lendo `row.attempts` — o nome em inglês —
  // a comparação era sempre `undefined >= max`, ou seja, false: nenhuma chave
  // jamais era trancada, em login, recuperação ou cadastro.
  if (row && Number(row.tentativas) >= max) {
    await sql`
      UPDATE tentativas_login
      SET travado_ate = now() + make_interval(mins => ${lockMinutes}),
          tentativas = 0,
          primeira_em = now()
      WHERE chave = ${key}
    `;
    return { locked: true };
  }

  return { locked: false };
}

export const isRateLimited = isRateLocked;
export const isLoginLocked = (handle: string) => isRateLocked(`login:${handle}`);
export const recordLoginFailure = (handle: string) => recordAttempt(`login:${handle}`);

export const loginTravado = isLoginLocked;
export const registrarFalhaLogin = recordLoginFailure;

const MAX_LOGINS_PER_IP = 30;

export const isIpLoginLocked = (ip: string) => isRateLocked(`loginip:${ip}`);
export const isLoginLockedByIp = isIpLoginLocked;
export const recordIpLoginFailure = (ip: string) =>
  recordAttempt(`loginip:${ip}`, MAX_LOGINS_PER_IP);
export const recordLoginFailureByIp = recordIpLoginFailure;

export const loginTravadoPorIp = isIpLoginLocked;
export const registrarFalhaLoginIp = recordIpLoginFailure;

export async function clearLoginAttempts(handle: string): Promise<void> {
  await sql`DELETE FROM tentativas_login WHERE chave = ${`login:${handle}`.trim().toLowerCase()}`;
}

export const limparTentativasLogin = clearLoginAttempts;

export async function countEnrolled(role: Role): Promise<number> {
  const dbPapel = normalizeRoleToDb(role);
  const [row] = await sql`SELECT count(*)::int AS n FROM users WHERE papel = ${dbPapel}`;
  return Number(row?.n ?? 0);
}

export const countEnrolledByRole = countEnrolled;
export const contarInscritos = countEnrolled;

export async function checkRoleSlots(
  role: Role,
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const max = SLOTS[role as keyof typeof SLOTS];
  if (max === undefined) return { ok: true };

  const total = await countEnrolled(role);
  if (total >= max) {
    const label = role === "editor" ? "editores" : "candidatos";
    const msg = `Lotado: atingimos o limite de ${max} ${label}. Tente novamente mais tarde.`;
    return { ok: false, error: msg, erro: msg };
  }
  return { ok: true };
}

export const checarVagaPapel = checkRoleSlots;

async function generateUniqueHandle(email: string): Promise<string> {
  const base =
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9._]/g, "")
      .slice(0, 20) || "usuario";
  let handle = base;

  for (let n = 1; n <= 50; n++) {
    const [existing] = await sql`SELECT id FROM users WHERE lower(apelido) = lower(${handle})`;
    if (!existing) return handle;
    handle = `${base}${n + 1}`;
  }

  return `${base.slice(0, 12)}${Math.random().toString(36).slice(2, 8)}`;
}

export const authenticateUser = authenticate;
export const isLoginLockedByHandle = isLoginLocked;
