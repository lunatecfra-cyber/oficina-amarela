import type {
  DailyChallenge,
  DayChallenge,
  DesafioDoDia,
  GamificationEventType,
} from "@oficina/db/gamification";
import { fetchApi, fetchApiJson } from "@/lib/internal-api";

export type { DailyChallenge, DayChallenge, DesafioDoDia, GamificationEventType };
export type TipoEventoGamificacao = "entrada_diaria" | "missao_entregue";

export async function recordDailyLogin(_userId?: number) {
  const res = await fetchApi("/editor/daily-login", { method: "POST" });
  if (!res.ok) return { recorded: false, xp: 0, registrado: false };
  return (await res.json()) as { recorded: boolean; xp: number; registrado?: boolean };
}

export async function listDailyChallenges(_userId?: number): Promise<DayChallenge[]> {
  const challenges = await fetchApiJson<DayChallenge[]>("/editor/challenges");
  return challenges ?? [];
}
