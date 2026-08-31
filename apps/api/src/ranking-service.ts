import type { RankingRepository } from "@oficina/db/ranking";
import { calculateConsistency, calculateUnlockedAwards } from "@oficina/domain/electoral-ranking";
import { countByWeek, cycleWeeks, weekKey } from "@oficina/domain/ranking-cycle";

/**
 * Ranking e progresso do editor.
 *
 * O agrupamento por semana acontece aqui, sobre datas puras, e não em SQL: a
 * regra passa a ser a mesma no PostgreSQL e no D1 em vez de existir duas vezes
 * em dialetos diferentes.
 */

export type EditorWeek = {
  week: string;
  goal: number;
  count: number;
  completed: boolean;
  saved: boolean;
};

/**
 * Gasta um bloqueio nas semanas fechadas que o editor não cumpriu.
 *
 * Só semanas encerradas entram: consumir na semana corrente cobraria por um
 * resultado que ainda pode acontecer.
 */
async function spendShieldsOnMissedWeeks(
  ranking: RankingRepository,
  editorId: number,
  cycle: { startsAt: string; endsAt: string; id: number },
  now: Date,
): Promise<void> {
  const weeks = cycleWeeks(new Date(cycle.startsAt), new Date(cycle.endsAt), now, {
    completedOnly: true,
  });
  if (weeks.length === 0) return;

  const [times, consumed] = await Promise.all([
    ranking.approvalTimes(cycle.id, editorId),
    ranking.consumedShieldWeeks(editorId),
  ]);
  const counts = countByWeek(
    weeks,
    times.map((value) => new Date(value)),
  );
  const alreadySaved = new Set(consumed);

  for (const [index, week] of weeks.entries()) {
    const key = weekKey(week);
    if (counts[index] >= week.goal || alreadySaved.has(key)) continue;
    if (!(await ranking.consumeShield(editorId, key))) break;
    alreadySaved.add(key);
  }
}

export async function editorProgress(
  ranking: RankingRepository,
  editorId: number,
  now = new Date(),
) {
  const cycle = await ranking.currentCycle();
  if (!cycle) {
    return {
      weeks: [] as EditorWeek[],
      semanas: [] as EditorWeek[],
      shields: 0,
      bloqueios: 0,
      referralCode: null as string | null,
      codigo_indicacao: null as string | null,
      sequence: 0,
      sequencia: 0,
      eligibleForDraw: false,
      elegivelAoSorteio: false,
    };
  }

  await spendShieldsOnMissedWeeks(ranking, editorId, cycle, now);

  const weeks = cycleWeeks(new Date(cycle.startsAt), new Date(cycle.endsAt), now);
  const [times, consumed, shields, referralCode] = await Promise.all([
    ranking.approvalTimes(cycle.id, editorId),
    ranking.consumedShieldWeeks(editorId),
    ranking.availableShields(editorId),
    ranking.referralCode(editorId),
  ]);

  const counts = countByWeek(
    weeks,
    times.map((value) => new Date(value)),
  );
  const saved = new Set(consumed);
  const detailed: EditorWeek[] = weeks.map((week, index) => {
    const key = weekKey(week);
    return {
      week: key,
      semana: key,
      goal: week.goal,
      meta: week.goal,
      count: counts[index],
      quantidade: counts[index],
      completed: counts[index] >= week.goal,
      cumpriu: counts[index] >= week.goal,
      saved: saved.has(key),
      salvo: saved.has(key),
    } as EditorWeek;
  });

  const consistency = calculateConsistency(
    detailed.map((week, index) => {
      if (week.completed || week.saved) return true;
      // A semana corrente ainda está aberta: o editor tem até o fim dela para
      // entregar, então ela não pode contar como semana perdida.
      return weeks[index].end.getTime() > now.getTime() ? "pending" : false;
    }),
    shields,
  );

  return {
    weeks: detailed,
    semanas: detailed,
    shields,
    bloqueios: shields,
    referralCode,
    codigo_indicacao: referralCode,
    sequence: consistency.sequence ?? consistency.sequencia ?? 0,
    sequencia: consistency.sequence ?? consistency.sequencia ?? 0,
    eligibleForDraw: Boolean(consistency.eligibleForDraw ?? consistency.elegivelAoSorteio),
    elegivelAoSorteio: Boolean(consistency.eligibleForDraw ?? consistency.elegivelAoSorteio),
  };
}

export async function electoralRanking(ranking: RankingRepository, now = new Date()) {
  await ranking.freezeExpiredCycles();
  const cycle = await ranking.currentCycle();
  if (!cycle) {
    return {
      items: [],
      itens: [],
      cycle: null,
      ciclo: null,
      activeEditors: 0,
      editoresAtivos: 0,
      highestActiveCount: 0,
      maiorNumeroDeAtivos: 0,
      awards: [],
      premios: [],
      eligibleForDraw: [],
      elegiveisSorteio: [],
    };
  }

  const items = await ranking.entriesForCycle(cycle.id);

  // Editor ativo é quem cumpriu a meta da semana corrente. A meta muda quando a
  // semana é encurtada pelo fim do ciclo, e é por isso que ela vem do domínio.
  const weeks = cycleWeeks(new Date(cycle.startsAt), new Date(cycle.endsAt), now);
  const current = weeks.at(-1);
  let activeCount = 0;
  if (current) {
    const perEditor = await Promise.all(
      items.map(async (item) => {
        const times = await ranking.approvalTimes(cycle.id, item.id);
        return (
          countByWeek(
            [current],
            times.map((value) => new Date(value)),
          )[0] >= current.goal
        );
      }),
    );
    activeCount = perEditor.filter(Boolean).length;
  }

  const milestone = await ranking.raiseActiveMilestone(cycle.id, activeCount);
  const awards = calculateUnlockedAwards(milestone);

  const eligibleForDraw: number[] = [];
  if (awards.includes("sorteio_constancia")) {
    for (const item of items) {
      const progress = await editorProgress(ranking, item.id, now);
      if (progress.eligibleForDraw) eligibleForDraw.push(item.id);
    }
  }

  return {
    items,
    itens: items,
    cycle,
    ciclo: cycle,
    activeEditors: activeCount,
    editoresAtivos: activeCount,
    highestActiveCount: milestone,
    maiorNumeroDeAtivos: milestone,
    awards,
    premios: awards,
    eligibleForDraw,
    elegiveisSorteio: eligibleForDraw,
  };
}
