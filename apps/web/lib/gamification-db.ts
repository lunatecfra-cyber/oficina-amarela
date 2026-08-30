import { type GamificationEventType, recordGamificationEvent } from "@oficina/db/gamification";
import { sql } from "@/lib/db";

export { type GamificationEventType, recordGamificationEvent };

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
