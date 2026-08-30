import type { Role } from "@oficina/domain/roles";
import { isUniqueViolation, sql, withTransaction } from "./client.ts";

/**
 * Contas e limite de tentativas.
 *
 * O repositório guarda e devolve dado; ele não decide se uma senha confere. O
 * hash sai daqui em claro para quem chama comparar, porque bcrypt é regra de
 * negócio e não armazenamento — e porque assim a mesma rota Hono serve
 * PostgreSQL e D1 sem duplicar a comparação.
 */

export type AccountRow = {
  id: number;
  handle: string;
  name: string;
  email: string;
  role: Role;
  passwordHash: string | null;
  banned: boolean;
};

export type CreateAccountInput = {
  handle: string;
  name: string;
  email: string;
  passwordHash?: string | null;
  googleId?: string | null;
  avatarUrl?: string | null;
  role: Role;
  referralCode?: string | null;
};

export type CreateAccountResult =
  | { ok: true; id: number }
  | { ok: false; reason: "handle_taken" | "email_taken" };

export type RateLock = { locked: boolean; minutes: number };

export interface AccountsRepository {
  findByHandle(handle: string): Promise<AccountRow | null>;
  findByEmail(email: string): Promise<AccountRow | null>;
  findByGoogleId(googleId: string): Promise<AccountRow | null>;
  /** Vincula o Google a uma conta que já existe por e-mail. */
  linkGoogleId(userId: number, googleId: string): Promise<AccountRow | null>;
  createAccount(input: CreateAccountInput): Promise<CreateAccountResult>;
  updatePassword(userId: number, passwordHash: string): Promise<void>;
  /** Libera as missões reservadas antes de apagar: elas voltam para a fila. */
  deleteAccount(userId: number): Promise<void>;
  /** Instante, em ms, a partir do qual as sessões valem. Null se não existe. */
  sessionCutoffMs(userId: number): Promise<number | null>;
  countByRole(role: Role): Promise<number>;
  isRateLocked(key: string): Promise<RateLock>;
  recordAttempt(
    key: string,
    max: number,
    windowMinutes: number,
    lockMinutes: number,
  ): Promise<{ locked: boolean }>;
  clearAttempts(key: string): Promise<void>;
}

/** O papel no banco usa 'voz'; o domínio usa 'spokesperson'. */
export function roleToDb(role: Role): string {
  return role === "spokesperson" ? "voz" : role;
}

export function roleFromDb(papel: string): Role {
  if (papel === "voz" || papel === "spokesperson") return "spokesperson";
  if (papel === "admin") return "admin";
  return "editor";
}

type UserRow = {
  id: number;
  apelido: string;
  nome: string;
  email: string;
  papel: string;
  senha_hash: string | null;
  banido: boolean | number | null;
};

export function toAccountRow(row: UserRow | undefined | null): AccountRow | null {
  if (!row) return null;
  return {
    id: Number(row.id),
    handle: row.apelido,
    name: row.nome,
    email: row.email,
    role: roleFromDb(row.papel),
    passwordHash: row.senha_hash ?? null,
    banned: Boolean(row.banido),
  };
}

const SELECT_ACCOUNT = "id, apelido, nome, email, papel, senha_hash, banido";

export const postgresAccounts: AccountsRepository = {
  async findByHandle(handle) {
    const [row] = await sql`
      SELECT id, apelido, nome, email, papel, senha_hash, banido
      FROM users WHERE lower(apelido) = lower(${handle.trim()})
    `;
    return toAccountRow(row as unknown as UserRow);
  },

  async findByEmail(email) {
    const [row] = await sql`
      SELECT id, apelido, nome, email, papel, senha_hash, banido
      FROM users WHERE lower(email) = lower(${email.trim()})
    `;
    return toAccountRow(row as unknown as UserRow);
  },

  async findByGoogleId(googleId) {
    const [row] = await sql`
      SELECT id, apelido, nome, email, papel, senha_hash, banido
      FROM users WHERE google_id = ${googleId}
    `;
    return toAccountRow(row as unknown as UserRow);
  },

  async linkGoogleId(userId, googleId) {
    const [row] = await sql`
      UPDATE users SET google_id = ${googleId} WHERE id = ${userId}
      RETURNING id, apelido, nome, email, papel, senha_hash, banido
    `;
    return toAccountRow(row as unknown as UserRow);
  },

  async createAccount(input) {
    try {
      const [row] = await sql`
        INSERT INTO users (
          apelido, nome, email, senha_hash, google_id, papel, foto_url, indicado_por_id
        ) VALUES (
          ${input.handle}, ${input.name}, ${input.email}, ${input.passwordHash ?? null},
          ${input.googleId ?? null}, ${roleToDb(input.role)}, ${input.avatarUrl ?? null},
          (SELECT id FROM users WHERE codigo_indicacao = ${input.referralCode ?? null}::uuid)
        )
        RETURNING id
      `;
      return { ok: true, id: Number(row.id) };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const taken = await postgresAccounts.findByHandle(input.handle);
      return { ok: false, reason: taken ? "handle_taken" : "email_taken" };
    }
  },

  async updatePassword(userId, passwordHash) {
    await sql`
      UPDATE users SET senha_hash = ${passwordHash}, sessoes_validas_apos = now()
      WHERE id = ${userId}
    `;
  },

  async deleteAccount(userId) {
    await withTransaction(async (transaction) => {
      await transaction`
        UPDATE pautas
        SET status = 'disponivel', reservada_por_id = NULL, reservada_ate = NULL,
            reservada_em = NULL
        WHERE reservada_por_id = ${userId} AND status IN ('reservada', 'reedicao', 'oferecida')
      `;
      await transaction`DELETE FROM users WHERE id = ${userId}`;
    });
  },

  async sessionCutoffMs(userId) {
    const [row] = await sql`SELECT sessoes_validas_apos FROM users WHERE id = ${userId}`;
    if (!row?.sessoes_validas_apos) return null;
    return new Date(row.sessoes_validas_apos as string).getTime();
  },

  async countByRole(role) {
    const [row] = await sql`
      SELECT count(*)::int AS total FROM users WHERE papel = ${roleToDb(role)}
    `;
    return Number(row?.total ?? 0);
  },

  async isRateLocked(key) {
    const [row] = await sql`
      SELECT travado_ate FROM tentativas_login WHERE chave = ${key.trim().toLowerCase()}
    `;
    if (!row?.travado_ate) return { locked: false, minutes: 0 };
    const remainingMs = new Date(row.travado_ate as string).getTime() - Date.now();
    if (remainingMs <= 0) return { locked: false, minutes: 0 };
    return { locked: true, minutes: Math.max(1, Math.ceil(remainingMs / 60000)) };
  },

  async recordAttempt(rawKey, max, windowMinutes, lockMinutes) {
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
    // A coluna se chama `tentativas`. Ler `row.attempts` — o nome em inglês —
    // fazia a comparação ser sempre `undefined >= max`, e nenhuma chave jamais
    // era trancada. O nome errado aqui é um defeito de segurança, não um typo.
    if (row && Number(row.tentativas) >= max) {
      await sql`
        UPDATE tentativas_login
        SET travado_ate = now() + make_interval(mins => ${lockMinutes}),
            tentativas = 0, primeira_em = now()
        WHERE chave = ${key}
      `;
      return { locked: true };
    }
    return { locked: false };
  },

  async clearAttempts(key) {
    await sql`DELETE FROM tentativas_login WHERE chave = ${key.trim().toLowerCase()}`;
  },
};

export { SELECT_ACCOUNT };
