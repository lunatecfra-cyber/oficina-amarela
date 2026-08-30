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

const SELECT_ACCOUNT = "id, apelido, nome, email, papel, senha_hash, banido";

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
          .prepare(`SELECT ${SELECT_ACCOUNT} FROM users WHERE lower(apelido) = lower(?)`)
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
      // O apelido não tem índice único no esquema, então a checagem é explícita;
      // o e-mail tem, e a violação dele é o que decide o outro motivo.
      const handleTaken = await db
        .prepare("SELECT id FROM users WHERE lower(apelido) = lower(?)")
        .bind(input.handle)
        .first<{ id: number }>();
      if (handleTaken) return { ok: false, reason: "handle_taken" };

      try {
        const created = await db
          .prepare(
            `INSERT INTO users (
               apelido, nome, email, senha_hash, google_id, papel, foto_url, indicado_por_id, sessoes_validas_apos
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT id FROM users WHERE codigo_indicacao = ?), '1970-01-01T00:00:00.000Z')
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
        .prepare("UPDATE users SET senha_hash = ?, sessoes_validas_apos = ? WHERE id = ?")
        .bind(passwordHash, new Date().toISOString(), userId)
        .run();
    },

    async deleteAccount(userId) {
      await db
        .prepare(
          `UPDATE pautas
           SET status = 'disponivel', reservada_por_id = NULL, reservada_ate = NULL,
               reservada_em = NULL
           WHERE reservada_por_id = ? AND status IN ('reservada', 'reedicao', 'oferecida')`,
        )
        .bind(userId)
        .run();
      await db.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
    },

    async sessionCutoffMs(userId) {
      const row = await db
        .prepare("SELECT sessoes_validas_apos FROM users WHERE id = ?")
        .bind(userId)
        .first<{ sessoes_validas_apos: string }>();
      return row?.sessoes_validas_apos ? new Date(row.sessoes_validas_apos).getTime() : null;
    },

    async countByRole(role) {
      const row = await db
        .prepare("SELECT count(*) AS total FROM users WHERE papel = ?")
        .bind(roleToDb(role))
        .first<{ total: number }>();
      return Number(row?.total ?? 0);
    },

    async isRateLocked(rawKey) {
      const row = await db
        .prepare("SELECT travado_ate FROM tentativas_login WHERE chave = ?")
        .bind(rawKey.trim().toLowerCase())
        .first<{ travado_ate: string | null }>();
      if (!row?.travado_ate) return { locked: false, minutes: 0 };
      const remainingMs = new Date(row.travado_ate).getTime() - Date.now();
      if (remainingMs <= 0) return { locked: false, minutes: 0 };
      return { locked: true, minutes: Math.max(1, Math.ceil(remainingMs / 60000)) };
    },

    async recordAttempt(rawKey, max, windowMinutes, lockMinutes) {
      const key = rawKey.trim().toLowerCase();
      const now = new Date();
      const windowStart = new Date(now.getTime() - windowMinutes * 60_000).toISOString();

      const counted = await db
        .prepare(
          `INSERT INTO tentativas_login (chave, tentativas, primeira_em)
           VALUES (?, 1, ?)
           ON CONFLICT (chave) DO UPDATE SET
             tentativas = CASE WHEN tentativas_login.primeira_em < ? THEN 1
                               ELSE tentativas_login.tentativas + 1 END,
             primeira_em = CASE WHEN tentativas_login.primeira_em < ? THEN ?
                                ELSE tentativas_login.primeira_em END
           RETURNING tentativas`,
        )
        .bind(key, now.toISOString(), windowStart, windowStart, now.toISOString())
        .first<{ tentativas: number }>();

      if (counted && Number(counted.tentativas) >= max) {
        await db
          .prepare(
            `UPDATE tentativas_login
             SET travado_ate = ?, tentativas = 0, primeira_em = ?
             WHERE chave = ?`,
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
        .prepare("DELETE FROM tentativas_login WHERE chave = ?")
        .bind(rawKey.trim().toLowerCase())
        .run();
    },
  };
}
