import { sql } from "./client.ts";

export type GamificationEventType =
  | "daily_login"
  | "mission_delivered"
  | "entrada_diaria"
  | "missao_entregue";

export type DayChallenge = {
  id: GamificationEventType;
  title: string;
  description: string;
  xp: number;
  completed: boolean;
  titulo?: string;
  descricao?: string;
  cumprido?: boolean;
};

export type DailyChallenge = DayChallenge;
export type DesafioDoDia = DayChallenge;

export const RULES: Record<
  "entrada_diaria" | "missao_entregue",
  Omit<DayChallenge, "completed">
> = {
  entrada_diaria: {
    id: "entrada_diaria",
    title: "Entrou no site",
    description: "Acesse a Oficina Amarela hoje.",
    xp: 10,
    titulo: "Entrou no site",
    descricao: "Acesse a Oficina Amarela hoje.",
  },
  missao_entregue: {
    id: "missao_entregue",
    title: "Entregue uma missão hoje",
    description: "Envie uma edição válida para revisão.",
    xp: 40,
    titulo: "Entregue uma missão hoje",
    descricao: "Envie uma edição válida para revisão.",
  },
};

const EVENT_XP = {
  entrada_diaria: 10,
  missao_entregue: 40,
} as const;

export function brasiliaDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export type GamificationRepository = {
  recordEvent(
    userId: number,
    ruleId: GamificationEventType,
    reference: string,
  ): Promise<{ recorded: boolean; xp: number; registrado?: boolean }>;
  recordDailyLogin(
    userId: number,
    date?: string,
  ): Promise<{ recorded: boolean; xp: number; registrado?: boolean }>;
  listDailyChallenges(userId: number, date?: string): Promise<DayChallenge[]>;
};

export const postgresGamification: GamificationRepository = {
  async recordEvent(userId, ruleId, reference) {
    const normalizedRule =
      ruleId === "daily_login" || ruleId === "entrada_diaria"
        ? "entrada_diaria"
        : "missao_entregue";
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
  },

  async recordDailyLogin(userId, date = brasiliaDate()) {
    return this.recordEvent(userId, "entrada_diaria", date);
  },

  async listDailyChallenges(userId, date = brasiliaDate()) {
    let rows: { regra_id: unknown }[] = [];
    try {
      rows = (await sql`
        SELECT regra_id
        FROM gamificacao_eventos
        WHERE user_id = ${userId}
          AND ((regra_id = 'entrada_diaria' AND referencia = ${date})
            OR (regra_id = 'missao_entregue' AND criado_em AT TIME ZONE 'America/Sao_Paulo' >= ${date}::date))
      `) as unknown as { regra_id: unknown }[];
    } catch {
      // Graceful fallback
    }

    const completedSet = new Set(rows.map((r) => String(r.regra_id)));
    return Object.values(RULES).map((rule) => {
      const isCompleted = completedSet.has(rule.id);
      return {
        ...rule,
        completed: isCompleted,
        cumprido: isCompleted,
      };
    });
  },
};

export async function recordGamificationEvent(
  userId: number,
  ruleId: GamificationEventType,
  reference: string,
): Promise<{ recorded: boolean; xp: number; registrado?: boolean }> {
  return postgresGamification.recordEvent(userId, ruleId, reference);
}

export async function recordDailyLogin(
  userId: number,
  date?: string,
): Promise<{ recorded: boolean; xp: number; registrado?: boolean }> {
  return postgresGamification.recordDailyLogin(userId, date);
}

export async function listDailyChallenges(userId: number, date?: string): Promise<DayChallenge[]> {
  return postgresGamification.listDailyChallenges(userId, date);
}
