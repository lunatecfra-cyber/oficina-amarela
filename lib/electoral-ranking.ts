export const ELECTORAL_CYCLE_END = new Date("2026-10-26T02:59:59.999Z");
export const FIM_CICLO_ELEITORAL = ELECTORAL_CYCLE_END;

export type ElectoralAward =
  | "ingresso_top1"
  | "bandeira_top2"
  | "caneca_top3"
  | "sorteio_constancia";

export type PremioEleitoral = ElectoralAward;

export function calculateWeeklyGoal(daysInCycle: number): 1 | 2 {
  return daysInCycle <= 4 ? 1 : 2;
}
export const calcularMetaSemanal = calculateWeeklyGoal;

export function calculateUnlockedAwards(activeEditors: number): ElectoralAward[] {
  const awards: ElectoralAward[] = [];
  if (activeEditors >= 10) awards.push("ingresso_top1");
  if (activeEditors >= 20) awards.push("bandeira_top2");
  if (activeEditors >= 30) awards.push("caneca_top3");
  if (activeEditors >= 50) awards.push("sorteio_constancia");
  return awards;
}
export const calcularPremios = calculateUnlockedAwards;

/**
 * Visual showcase metadata: label and milestone for each award in unlock order.
 */
export const ELECTORAL_AWARDS = [
  {
    chave: "ingresso_top1" as const,
    key: "ingresso_top1" as const,
    ativos: 10,
    activeThreshold: 10,
    premio: "Ingresso",
    award: "Ingresso",
    quem: "Top 1",
    target: "Top 1",
    segredo: false,
    isSecret: false,
  },
  {
    chave: "bandeira_top2" as const,
    key: "bandeira_top2" as const,
    ativos: 20,
    activeThreshold: 20,
    premio: "Bandeira",
    award: "Bandeira",
    quem: "Top 2",
    target: "Top 2",
    segredo: true,
    isSecret: true,
  },
  {
    chave: "caneca_top3" as const,
    key: "caneca_top3" as const,
    ativos: 30,
    activeThreshold: 30,
    premio: "Caneca",
    award: "Caneca",
    quem: "Top 3",
    target: "Top 3",
    segredo: true,
    isSecret: true,
  },
  {
    chave: "sorteio_constancia" as const,
    key: "sorteio_constancia" as const,
    ativos: 50,
    activeThreshold: 50,
    premio: "Sorteio",
    award: "Sorteio",
    quem: "Por constância",
    target: "Por constância",
    segredo: false,
    isSecret: false,
  },
] as const;

export const PREMIOS_ELEITORAIS = ELECTORAL_AWARDS;

export function calculateConsistency(completedWeeks: boolean[], availableShields: number) {
  let sequence = 0;
  let maxSequence = 0;
  let consumedShields = 0;

  for (const completed of completedWeeks) {
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

  const eligibleForDraw = maxSequence >= 4;
  return {
    sequence,
    sequencia: sequence,
    consumedShields,
    bloqueiosConsumidos: consumedShields,
    eligibleForDraw,
    elegivelAoSorteio: eligibleForDraw,
  };
}
export const calcularConstancia = calculateConsistency;

export function canReferralAward(
  approvedVideos: number,
  rewardsInMonth: number,
  alreadyAwarded: boolean,
): boolean {
  return approvedVideos >= 2 && rewardsInMonth < 5 && !alreadyAwarded;
}
export const indicacaoPodePremiar = canReferralAward;

export type RankingItem = {
  editorId: number;
  quantidade?: number;
  count?: number;
  atingiuQuantidadeEm?: Date;
  reachedCountAt?: Date;
};

export type ItemRanking = RankingItem;

export function sortRanking<T extends RankingItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const qtyA = a.count ?? a.quantidade ?? 0;
    const qtyB = b.count ?? b.quantidade ?? 0;
    const timeA = (a.reachedCountAt ?? a.atingiuQuantidadeEm ?? new Date(0)).getTime();
    const timeB = (b.reachedCountAt ?? b.atingiuQuantidadeEm ?? new Date(0)).getTime();
    return qtyB - qtyA || timeA - timeB || a.editorId - b.editorId;
  });
}
export const ordenarRanking = sortRanking;

export type QueriedInvitation = {
  email: string;
  expiraEm?: Date;
  expiresAt?: Date;
  usadoEm?: Date | null;
  usedAt?: Date | null;
  revogadoEm?: Date | null;
  revokedAt?: Date | null;
};

export type ConviteConsultado = QueriedInvitation;

export function canInvitationBeUsed(
  invitation: QueriedInvitation,
  email: string,
  now = new Date(),
): boolean {
  const exp = invitation.expiresAt ?? invitation.expiraEm;
  const used = invitation.usedAt ?? invitation.usadoEm;
  const revoked = invitation.revokedAt ?? invitation.revogadoEm;

  return (
    invitation.email.trim().toLowerCase() === email.trim().toLowerCase() &&
    !!exp &&
    exp.getTime() > now.getTime() &&
    (used === null || used === undefined) &&
    (revoked === null || revoked === undefined)
  );
}
export const convitePodeSerUsado = canInvitationBeUsed;
