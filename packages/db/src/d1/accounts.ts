import { type AccountsRepository, roleToDb, toAccountRow } from "../accounts.ts";
import type { D1DatabaseLike } from "./types.ts";

/**
 * Paridade D1 de contas e limite de tentativas.
 *
 * O SQLite não tem `now()` nem intervalo, então o instante e as janelas vêm
 * calculados de fora. O limite de tentativas continua sendo uma decisão em uma
 * instrução só onde dá, e o resto é aritmética de data em JavaScript — o que
 * importa é a chave trancar ao atingir o máximo, não onde a subtração acontece.
 */

const SELECT_ACCOUNT = "id, handle, name, email, role, password_hash, is_banned";

type UserRow = Parameters<typeof toAccountRow>[0];

export function createD1Accounts(db: D1DatabaseLike): AccountsRepository {
  async function accountById(userId: number) {
    return toAccountRow(
      await db
        .prepare(`SELECT ${SELECT_ACCOUNT} FROM users WHERE id = ?`)
        .bind(userId)
        .first<NonNullable<UserRow>>(),
    );
  }

  return {
    async findByHandle(handle) {
      return toAccountRow(
        await db
          .prepare(`SELECT ${SELECT_ACCOUNT} FROM users WHERE lower(handle) = lower(?)`)
          .bind(handle.trim())
          .first<NonNullable<UserRow>>(),
      );
    },

    async findByEmail(email) {
      return toAccountRow(
        await db
          .prepare(`SELECT ${SELECT_ACCOUNT} FROM users WHERE lower(email) = lower(?)`)
          .bind(email.trim())
          .first<NonNullable<UserRow>>(),
      );
    },

    async findByHandleOrEmail(identity) {
      const value = identity.trim();
      return toAccountRow(
        await db
          .prepare(
            `SELECT ${SELECT_ACCOUNT} FROM users
             WHERE lower(handle) = lower(?) OR lower(email) = lower(?)`,
          )
          .bind(value, value)
          .first<NonNullable<UserRow>>(),
      );
    },

    async findByGoogleId(googleId) {
      return toAccountRow(
        await db
          .prepare(`SELECT ${SELECT_ACCOUNT} FROM users WHERE google_id = ?`)
          .bind(googleId)
          .first<NonNullable<UserRow>>(),
      );
    },

    async linkGoogleId(userId, googleId) {
      await db.prepare("UPDATE users SET google_id = ? WHERE id = ?").bind(googleId, userId).run();
      return accountById(userId);
    },

    async createAccount(input) {
      const handleTaken = await db
        .prepare("SELECT id FROM users WHERE lower(handle) = lower(?)")
        .bind(input.handle)
        .first<{ id: number }>();
      if (handleTaken) return { ok: false, reason: "handle_taken" };

      try {
        const created = await db
          .prepare(
            `INSERT INTO users (
               handle, name, email, password_hash, google_id, role, avatar_url, referred_by_id, sessions_valid_after
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT id FROM users WHERE referral_code = ?), '1970-01-01T00:00:00.000Z')
             RETURNING id`,
          )
          .bind(
            input.handle,
            input.name,
            input.email,
            input.passwordHash ?? null,
            input.googleId ?? null,
            roleToDb(input.role),
            input.avatarUrl ?? null,
            input.referralCode ?? null,
          )
          .first<{ id: number }>();
        if (!created) return { ok: false, reason: "email_taken" };
        return { ok: true, id: Number(created.id) };
      } catch (error) {
        if (/UNIQUE constraint failed/.test(String(error))) {
          return { ok: false, reason: "email_taken" };
        }
        throw error;
      }
    },

    async updatePassword(userId, passwordHash) {
      await db
        .prepare("UPDATE users SET password_hash = ?, sessions_valid_after = ? WHERE id = ?")
        .bind(passwordHash, new Date().toISOString(), userId)
        .run();
    },

    async deleteAccount(userId) {
      await db
        .prepare(
          `UPDATE missions
           SET status = 'disponivel', reserved_by_id = NULL, reserved_until = NULL,
               reserved_at = NULL
           WHERE reserved_by_id = ? AND status IN ('reservada', 'reedicao', 'oferecida')`,
        )
        .bind(userId)
        .run();
      await db.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
    },

    async sessionCutoffMs(userId) {
      const row = await db
        .prepare("SELECT sessions_valid_after FROM users WHERE id = ?")
        .bind(userId)
        .first<{ sessions_valid_after: string }>();
      return row?.sessions_valid_after ? new Date(row.sessions_valid_after).getTime() : null;
    },

    async countByRole(role) {
      const row = await db
        .prepare("SELECT count(*) AS total FROM users WHERE role = ?")
        .bind(roleToDb(role))
        .first<{ total: number }>();
      return Number(row?.total ?? 0);
    },

    async isRateLocked(rawKey) {
      const row = await db
        .prepare("SELECT locked_until FROM login_attempts WHERE key = ?")
        .bind(rawKey.trim().toLowerCase())
        .first<{ locked_until: string | null }>();
      if (!row?.locked_until) return { locked: false, minutes: 0 };
      const remainingMs = new Date(row.locked_until).getTime() - Date.now();
      if (remainingMs <= 0) return { locked: false, minutes: 0 };
      return { locked: true, minutes: Math.max(1, Math.ceil(remainingMs / 60000)) };
    },

    async recordAttempt(rawKey, max, windowMinutes, lockMinutes) {
      const key = rawKey.trim().toLowerCase();
      const now = new Date();
      const windowStart = new Date(now.getTime() - windowMinutes * 60_000).toISOString();

      const counted = await db
        .prepare(
          `INSERT INTO login_attempts (key, attempts, first_at)
           VALUES (?, 1, ?)
           ON CONFLICT (key) DO UPDATE SET
             attempts = CASE WHEN login_attempts.first_at < ? THEN 1
                             ELSE login_attempts.attempts + 1 END,
             first_at = CASE WHEN login_attempts.first_at < ? THEN ?
                             ELSE login_attempts.first_at END
           RETURNING attempts`,
        )
        .bind(key, now.toISOString(), windowStart, windowStart, now.toISOString())
        .first<{ attempts: number }>();

      if (counted && Number(counted.attempts) >= max) {
        await db
          .prepare(
            `UPDATE login_attempts
             SET locked_until = ?, attempts = 0, first_at = ?
             WHERE key = ?`,
          )
          .bind(
            new Date(now.getTime() + lockMinutes * 60_000).toISOString(),
            now.toISOString(),
            key,
          )
          .run();
        return { locked: true };
      }
      return { locked: false };
    },

    async clearAttempts(rawKey) {
      await db
        .prepare("DELETE FROM login_attempts WHERE key = ?")
        .bind(rawKey.trim().toLowerCase())
        .run();
    },
  };
}
