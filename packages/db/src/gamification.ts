import { sql } from "./client.ts";

export type GamificationEventType =
  | "daily_login"
  | "mission_delivered"
  | "entrada_diaria"
  | "missao_entregue";

const EVENT_XP = {
  entrada_diaria: 10,
  missao_entregue: 40,
} as const;

export async function recordGamificationEvent(
  userId: number,
  ruleId: GamificationEventType,
  reference: string,
): Promise<{ recorded: boolean; xp: number; registrado?: boolean }> {
  const normalizedRule =
    ruleId === "daily_login" || ruleId === "entrada_diaria" ? "entrada_diaria" : "missao_entregue";
  const xp = EVENT_XP[normalizedRule];

  const [event] = await sql`
    WITH novo_evento AS (
      INSERT INTO gamificacao_eventos (user_id, regra_id, referencia, xp)
      VALUES (${userId}, ${normalizedRule}, ${reference}, ${xp})
      ON CONFLICT (user_id, regra_id, referencia) DO NOTHING
      RETURNING xp
    )
    UPDATE users
    SET reputacao = users.reputacao + novo_evento.xp
    FROM novo_evento
    WHERE users.id = ${userId}
    RETURNING novo_evento.xp
  `;

  return event
    ? { recorded: true, xp: Number(event.xp), registrado: true }
    : { recorded: false, xp: 0, registrado: false };
}
