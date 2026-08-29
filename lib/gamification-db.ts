import { sql } from "@/lib/db";

export type GamificationEventType =
  | "daily_login"
  | "mission_delivered"
  | "entrada_diaria"
  | "missao_entregue";

export type TipoEventoGamificacao = GamificationEventType;

export type DayChallenge = {
  id: GamificationEventType;
  title: string;
  description: string;
  xp: number;
  completed: boolean;
  // aliases
  titulo?: string;
  descricao?: string;
  cumprido?: boolean;
};

export type DailyChallenge = DayChallenge;
export type DesafioDoDia = DayChallenge;

const RULES: Record<"daily_login" | "mission_delivered", Omit<DayChallenge, "completed">> = {
  daily_login: {
    id: "daily_login",
    title: "Entrou no site",
    description: "Acesse a Oficina Amarela hoje.",
    xp: 10,
    titulo: "Entrou no site",
    descricao: "Acesse a Oficina Amarela hoje.",
  },
  mission_delivered: {
    id: "mission_delivered",
    title: "Entregue uma missão hoje",
    description: "Envie uma edição válida para revisão.",
    xp: 40,
    titulo: "Entregue uma missão hoje",
    descricao: "Envie uma edição válida para revisão.",
  },
};

function brasiliaDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export async function recordGamificationEvent(
  userId: number,
  ruleId: GamificationEventType,
  reference: string
): Promise<{ recorded: boolean; xp: number; registrado?: boolean }> {
  const normRule = ruleId === "entrada_diaria" ? "daily_login" : ruleId === "missao_entregue" ? "mission_delivered" : ruleId;
  const rule = RULES[normRule as keyof typeof RULES];
  if (!rule) return { recorded: false, xp: 0, registrado: false };

  const [event] = await sql`
    WITH new_event AS (
      INSERT INTO gamification_events (user_id, rule_id, reference, xp)
      VALUES (${userId}, ${normRule}, ${reference}, ${rule.xp})
      ON CONFLICT (user_id, rule_id, reference) DO NOTHING
      RETURNING xp
    )
    UPDATE users
    SET reputation = users.reputation + new_event.xp
    FROM new_event
    WHERE users.id = ${userId}
    RETURNING new_event.xp
  `;

  return event
    ? { recorded: true, xp: Number(event.xp), registrado: true }
    : { recorded: false, xp: 0, registrado: false };
}

export const registrarEventoGamificacao = recordGamificationEvent;

export async function recordDailyLogin(userId: number) {
  return recordGamificationEvent(userId, "daily_login", brasiliaDate());
}

export const registrarEntradaDiaria = recordDailyLogin;

export async function listDailyChallenges(userId: number): Promise<DayChallenge[]> {
  const today = brasiliaDate();
  let rows: { rule_id: unknown }[] = [];
  try {
    rows = (await sql`
      SELECT rule_id
      FROM gamification_events
      WHERE user_id = ${userId}
        AND ((rule_id IN ('daily_login', 'entrada_diaria') AND reference = ${today})
          OR (rule_id IN ('mission_delivered', 'missao_entregue') AND created_at AT TIME ZONE 'America/Sao_Paulo' >= ${today}::date))
    `) as unknown as { rule_id: unknown }[];
  } catch {
    // Graceful fallback
  }

  const completedSet = new Set(rows.map((r) => String(r.rule_id)));
  return Object.values(RULES).map((rule) => {
    const isCompleted = completedSet.has(rule.id) || (rule.id === "daily_login" && completedSet.has("entrada_diaria")) || (rule.id === "mission_delivered" && completedSet.has("missao_entregue"));
    return {
      ...rule,
      completed: isCompleted,
      cumprido: isCompleted,
    };
  });
}

export const listarDesafiosDoDia = listDailyChallenges;
