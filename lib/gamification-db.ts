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
    xp: 25,
    titulo: "Entrou no site",
    descricao: "Acesse a Oficina Amarela hoje.",
  },
  mission_delivered: {
    id: "mission_delivered",
    title: "Entregou um vídeo",
    description: "Cada vídeo entregue soma 100 XP.",
    xp: 100,
    titulo: "Entregou um vídeo",
    descricao: "Cada vídeo entregue soma 100 XP.",
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
      INSERT INTO gamificacao_eventos (user_id, regra_id, referencia, xp)
      VALUES (${userId}, ${normRule === "daily_login" ? "entrada_diaria" : "missao_entregue"}, ${reference}, ${rule.xp})
      ON CONFLICT (user_id, regra_id, referencia) DO NOTHING
      RETURNING xp
    )
    UPDATE users
    SET reputacao = users.reputacao + new_event.xp
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
      SELECT regra_id AS rule_id
      FROM gamificacao_eventos
      WHERE user_id = ${userId}
        AND ((regra_id = 'entrada_diaria' AND referencia = ${today})
          OR (regra_id = 'missao_entregue' AND criado_em AT TIME ZONE 'America/Sao_Paulo' >= ${today}::date))
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
