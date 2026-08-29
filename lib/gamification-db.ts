import { sql } from "@/lib/db";

export type GamificationEventType =
  | "daily_login"
  | "mission_delivered"
  | "entrada_diaria"
  | "missao_entregue";

export type TipoEventoGamificacao = "entrada_diaria" | "missao_entregue";

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

const RULES: Record<"entrada_diaria" | "missao_entregue", Omit<DayChallenge, "completed">> = {
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
  const normRule: "entrada_diaria" | "missao_entregue" =
    ruleId === "daily_login" || ruleId === "entrada_diaria" ? "entrada_diaria" : "missao_entregue";
  const rule = RULES[normRule];
  if (!rule) return { recorded: false, xp: 0, registrado: false };

  const [event] = await sql`
    WITH novo_evento AS (
      INSERT INTO gamificacao_eventos (user_id, regra_id, referencia, xp)
      VALUES (${userId}, ${normRule}, ${reference}, ${rule.xp})
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

export const registrarEventoGamificacao = recordGamificationEvent;

export async function recordDailyLogin(userId: number) {
  return recordGamificationEvent(userId, "entrada_diaria", brasiliaDate());
}

export const registrarEntradaDiaria = recordDailyLogin;

export async function listDailyChallenges(userId: number): Promise<DayChallenge[]> {
  const today = brasiliaDate();
  let rows: { regra_id: unknown }[] = [];
  try {
    rows = (await sql`
      SELECT regra_id
      FROM gamificacao_eventos
      WHERE user_id = ${userId}
        AND ((regra_id = 'entrada_diaria' AND referencia = ${today})
          OR (regra_id = 'missao_entregue' AND criado_em AT TIME ZONE 'America/Sao_Paulo' >= ${today}::date))
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
}

export const listarDesafiosDoDia = listDailyChallenges;
