import type { AccountsRepository } from "@oficina/db/accounts";
import type { InvitationRedemptionRepository } from "@oficina/db/invitation-redemption";
import { hashInvitation } from "@oficina/domain/invitations";
import { SLOTS } from "@oficina/domain/limits";
import type { Role } from "@oficina/domain/roles";

/**
 * Criação de conta.
 *
 * Um lugar só decide quem pode existir. O portão de legitimidade do porta-voz
 * mora aqui: só o convite emitido pelo inspetor cria conta oficial, e nenhum
 * papel além de editor e porta-voz sai de auto-cadastro — 'admin' não é
 * pedível. Antes isso dependia de cada rota lembrar de limitar.
 */

const HANDLE_PATTERN = /^[a-zA-Z0-9._]{3,24}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const LIMITS = { name: 120, handle: 24, email: 254, password: 200 };

export type RegistrationInput = {
  name: unknown;
  handle: unknown;
  email: unknown;
  role: unknown;
  password?: unknown;
  googleId?: string | null;
  avatarUrl?: string | null;
  invitation?: string | null;
  referralCode?: string | null;
};

export type RegistrationFailure =
  | { status: 400; error: string }
  | { status: 403; error: string }
  | { status: 409; error: string };

export type RegisteredAccount = {
  id: number;
  handle: string;
  name: string;
  email: string;
  role: Role;
};

/** Só editor e porta-voz saem de auto-cadastro. Nunca admin. */
export function selfAssignableRole(role: unknown): Role {
  return role === "spokesperson" || role === "voz" ? "spokesperson" : "editor";
}

function limit(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function invitationFailureMessage(reason: string): string {
  if (reason === "email_mismatch") return "Este convite pertence a outro e-mail.";
  if (reason === "invitation_revoked") return "Este convite foi revogado.";
  if (reason === "invitation_used") return "Este convite já foi usado.";
  if (reason === "invitation_expired") return "Este convite expirou.";
  if (reason === "account_conflict") return "Apelido ou e-mail já cadastrado.";
  return "Convite inválido.";
}

export async function registerAccount(
  accounts: AccountsRepository,
  invitations: InvitationRedemptionRepository,
  input: RegistrationInput,
  options: { requirePassword: boolean },
): Promise<{ ok: true; account: RegisteredAccount } | ({ ok: false } & RegistrationFailure)> {
  const name = limit(input.name, LIMITS.name);
  const handle = limit(input.handle, LIMITS.handle);
  const email = limit(input.email, LIMITS.email).toLowerCase();
  const password = typeof input.password === "string" ? input.password : "";

  if (!name) return { ok: false, status: 400, error: "Digite seu nome." };
  if (!HANDLE_PATTERN.test(handle)) {
    return {
      ok: false,
      status: 400,
      error: "Apelido deve ter 3-24 letras, números, ponto ou underline.",
    };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, status: 400, error: "Digite um e-mail válido." };
  }
  if (options.requirePassword) {
    if (password.length < 6) {
      return { ok: false, status: 400, error: "Senha precisa de pelo menos 6 caracteres." };
    }
    if (password.length > LIMITS.password) {
      return { ok: false, status: 400, error: "Senha longa demais." };
    }
  }

  const role = selfAssignableRole(input.role);
  const referralCode =
    typeof input.referralCode === "string" && UUID_PATTERN.test(input.referralCode)
      ? input.referralCode
      : null;

  const enrolled = await accounts.countByRole(role);
  const cap = role === "spokesperson" ? SLOTS.spokesperson : SLOTS.editor;
  if (enrolled >= cap) {
    return {
      ok: false,
      status: 403,
      error:
        role === "spokesperson"
          ? "As vagas de porta-voz estão esgotadas."
          : "As vagas de editor estão esgotadas.",
    };
  }

  const passwordHash = options.requirePassword ? await hashPassword(password) : null;

  // Porta-voz oficial só nasce de um convite válido. O resgate é atômico e de
  // uso único nos dois bancos; não existe um segundo estado de aprovação.
  if (role === "spokesperson") {
    const invitation = typeof input.invitation === "string" ? input.invitation : "";
    if (!invitation) {
      return { ok: false, status: 400, error: "Convite especial obrigatório para porta-voz." };
    }
    const redeemed = await invitations.redeemInvitation({
      tokenHash: await hashInvitation(invitation),
      email,
      handle,
      name,
      passwordHash,
      googleId: input.googleId ?? null,
      avatarUrl: input.avatarUrl ?? null,
      referralCode,
    });
    if (!redeemed.ok) {
      const conflict = redeemed.reason === "account_conflict";
      return {
        ok: false,
        status: conflict ? 409 : 400,
        error: invitationFailureMessage(redeemed.reason),
      };
    }
    return { ok: true, account: { id: redeemed.userId, handle, name, email, role } };
  }

  const created = await accounts.createAccount({
    handle,
    name,
    email,
    passwordHash,
    googleId: input.googleId ?? null,
    avatarUrl: input.avatarUrl ?? null,
    role,
    referralCode,
  });
  if (!created.ok) {
    return {
      ok: false,
      status: 409,
      error:
        created.reason === "handle_taken"
          ? "Esse apelido já está em uso."
          : "Esse e-mail já está cadastrado.",
    };
  }
  return { ok: true, account: { id: created.id, handle, name, email, role } };
}

/** bcryptjs é JS puro, então roda no workerd; o custo de CPU é conhecido. */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.default.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.default.compare(password, hash);
}

/**
 * Hash de descarte para comparar mesmo quando a conta não existe: sem isso o
 * tempo de resposta diria se o apelido existe ou não.
 */
export const DUMMY_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
