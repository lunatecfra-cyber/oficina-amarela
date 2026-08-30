import type { GamificationEventType } from "../gamification.ts";
import type { D1DatabaseLike } from "./types.ts";

/**
 * Paridade D1 do registro de evento de gamificação.
 *
 * O PostgreSQL resolve em uma CTE que insere e soma; o SQLite não tem CTE que
 * modifica dado. A unicidade (user_id, regra_id, referencia) continua sendo a
 * invariante: o INSERT OR IGNORE decide se o evento é novo, e só então a
 * reputação sobe. Repetir a chamada não pontua de novo.
 */

const EVENT_XP = {
  entrada_diaria: 10,
  missao_entregue: 40,
} as const;

export function createD1Gamification(db: D1DatabaseLike) {
  return async function recordGamificationEvent(
    userId: number,
    ruleId: GamificationEventType,
    reference: string,
  ): Promise<{ recorded: boolean; xp: number; registrado?: boolean }> {
    const normalizedRule =
      ruleId === "daily_login" || ruleId === "entrada_diaria"
        ? "entrada_diaria"
        : "missao_entregue";
    const xp = EVENT_XP[normalizedRule];

    const inserted = await db
      .prepare(
        `INSERT OR IGNORE INTO gamificacao_eventos (user_id, regra_id, referencia, xp)
         VALUES (?, ?, ?, ?) RETURNING xp`,
      )
      .bind(userId, normalizedRule, reference, xp)
      .first<{ xp: number }>();
    if (!inserted) return { recorded: false, xp: 0, registrado: false };

    await db
      .prepare("UPDATE users SET reputacao = reputacao + ? WHERE id = ?")
      .bind(xp, userId)
      .run();

    return { recorded: true, xp: Number(inserted.xp), registrado: true };
  };
}
