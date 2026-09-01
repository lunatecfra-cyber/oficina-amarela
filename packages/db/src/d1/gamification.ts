import {
  brasiliaDate,
  type DayChallenge,
  EVENT_XP,
  type GamificationEventType,
  type GamificationRepository,
  RULES,
} from "../gamification.ts";
import type { D1DatabaseLike } from "./types.ts";

/**
 * Paridade D1 do registro de evento de gamificação.
 *
 * O PostgreSQL resolve em uma CTE que insere e soma; o SQLite não tem CTE que
 * modifica dado. A unicidade (user_id, regra_id, referencia) continua sendo a
 * invariante: o INSERT OR IGNORE decide se o evento é novo, e só então a
 * reputação sobe. Repetir a chamada não pontua de novo.
 */

export function createD1Gamification(
  db: D1DatabaseLike,
): GamificationRepository &
  ((
    userId: number,
    ruleId: GamificationEventType,
    reference: string,
  ) => Promise<{ recorded: boolean; xp: number; registrado?: boolean }>) {
  async function recordEvent(
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
        `INSERT OR IGNORE INTO gamification_events (user_id, rule_id, reference, xp)
         VALUES (?, ?, ?, ?) RETURNING xp`,
      )
      .bind(userId, normalizedRule, reference, xp)
      .first<{ xp: number }>();
    if (!inserted) return { recorded: false, xp: 0, registrado: false };

    await db
      .prepare("UPDATE users SET reputation = reputation + ? WHERE id = ?")
      .bind(xp, userId)
      .run();

    return { recorded: true, xp: Number(inserted.xp), registrado: true };
  }

  async function recordDailyLogin(
    userId: number,
    date = brasiliaDate(),
  ): Promise<{ recorded: boolean; xp: number; registrado?: boolean }> {
    return recordEvent(userId, "entrada_diaria", date);
  }

  async function listDailyChallenges(
    userId: number,
    date = brasiliaDate(),
  ): Promise<DayChallenge[]> {
    let rows: { rule_id?: unknown; regra_id?: unknown }[] = [];
    try {
      const result = await db
        .prepare(
          `SELECT rule_id
           FROM gamification_events
           WHERE user_id = ?
             AND ((rule_id = 'entrada_diaria' AND reference = ?)
               OR (rule_id = 'missao_entregue' AND date(created_at) >= ?))`,
        )
        .bind(userId, date, date)
        .all<{ rule_id?: unknown; regra_id?: unknown }>();
      rows = result.results ?? [];
    } catch {
      // Graceful fallback
    }

    const completedSet = new Set(rows.map((r) => String(r.rule_id ?? r.regra_id)));
    return Object.values(RULES).map((rule) => {
      const isCompleted = completedSet.has(rule.id);
      return {
        ...rule,
        completed: isCompleted,
        cumprido: isCompleted,
      };
    });
  }

  const callable = Object.assign(recordEvent, {
    recordEvent,
    recordDailyLogin,
    listDailyChallenges,
  });

  return callable;
}
