export const ELECTORAL_CYCLE_END = new Date("2026-10-26T02:59:59.999Z");

export type ElectoralAward =
  | "ingresso_top1"
  | "bandeira_top2"
  | "caneca_top3"
  | "sorteio_constancia";

export function calculateWeeklyGoal(daysInCycle: number): 1 | 2 {
  return daysInCycle <= 4 ? 1 : 2;
}

export function calculateUnlockedAwards(activeEditors: number): ElectoralAward[] {
  const awards: ElectoralAward[] = [];
  if (activeEditors >= 10) awards.push("ingresso_top1");
  if (activeEditors >= 20) awards.push("bandeira_top2");
  if (activeEditors >= 30) awards.push("caneca_top3");
  if (activeEditors >= 50) awards.push("sorteio_constancia");
  return awards;
}

/**
 * Visual showcase metadata: label and milestone for each award in unlock order.
 */
export const ELECTORAL_AWARDS = [
  {
    key: "ingresso_top1" as const,
    activeThreshold: 10,
    award: "Ingresso",
    target: "Top 1",
    isSecret: false,
  },
  {
    key: "bandeira_top2" as const,
    activeThreshold: 20,
    award: "Bandeira",
    target: "Top 2",
    isSecret: true,
  },
  {
    key: "caneca_top3" as const,
    activeThreshold: 30,
    award: "Caneca",
    target: "Top 3",
    isSecret: true,
  },
  {
    key: "sorteio_constancia" as const,
    activeThreshold: 50,
    award: "Sorteio",
    target: "Por constância",
    isSecret: false,
  },
] as const;

/**
 * `"pending"` é a semana que ainda não acabou.
 *
 * Sem ela, a semana corrente entrava como semana perdida assim que o editor
 * ainda não tinha entregue — zerava a sequência dele toda segunda-feira e
 * chegava a gastar um bloqueio para cobrir uma semana em que ainda dava tempo
 * de entregar. Semana em curso não conta nem a favor nem contra.
 */
export type ConsistencyWeek = boolean | "pending";

export function calculateConsistency(completedWeeks: ConsistencyWeek[], availableShields: number) {
  let sequence = 0;
  let maxSequence = 0;
  let consumedShields = 0;

  for (const completed of completedWeeks) {
    if (completed === "pending") continue;
    if (completed) {
      sequence += 1;
    } else if (consumedShields < availableShields) {
      consumedShields += 1;
      sequence += 1;
    } else {
      sequence = 0;
    }
    maxSequence = Math.max(maxSequence, sequence);
  }

  return { sequence, consumedShields, eligibleForDraw: maxSequence >= 4 };
}

export function canReferralAward(
  approvedVideos: number,
  rewardsInMonth: number,
  alreadyAwarded: boolean,
): boolean {
  return approvedVideos >= 2 && rewardsInMonth < 5 && !alreadyAwarded;
}

export type RankingItem = {
  editorId: number;
  count: number;
  reachedCountAt?: Date;
};

export function sortRanking<T extends RankingItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const timeA = (a.reachedCountAt ?? new Date(0)).getTime();
    const timeB = (b.reachedCountAt ?? new Date(0)).getTime();
    return b.count - a.count || timeA - timeB || a.editorId - b.editorId;
  });
}

export type QueriedInvitation = {
  email: string;
  expiresAt: Date;
  usedAt?: Date | null;
  revokedAt?: Date | null;
};

export function canInvitationBeUsed(
  invitation: QueriedInvitation,
  email: string,
  now = new Date(),
): boolean {
  return (
    invitation.email.trim().toLowerCase() === email.trim().toLowerCase() &&
    invitation.expiresAt.getTime() > now.getTime() &&
    !invitation.usedAt &&
    !invitation.revokedAt
  );
}
