import { calculateWeeklyGoal } from "./electoral-ranking.ts";

/**
 * Janelas semanais de um ciclo do ranking.
 *
 * Isto era SQL do PostgreSQL: `generate_series` sobre `date_trunc('week', …)`,
 * com `LEAST` e `extract(epoch …)` para medir a última semana. O SQLite não tem
 * nenhum dos três, e reescrever aquilo em duas dialetos seria manter a mesma
 * regra em dois lugares — onde ela acabaria divergindo.
 *
 * Como é aritmética de data, e não busca de dado, o lugar dela é aqui: os dois
 * repositórios passam a só buscar aprovações e bloqueios, e a regra de semana é
 * a mesma para os dois. De quebra ela fica testável sem banco nenhum.
 */

export type CycleWeek = {
  /** Início da semana, meia-noite UTC de segunda-feira. */
  start: Date;
  /** Fim exclusivo: sete dias depois, ou o fim do ciclo se ele vier antes. */
  end: Date;
  /** Quantas aprovações a semana exige. Semana curta cobra menos. */
  goal: 1 | 2;
};

/** Segunda-feira 00:00 UTC da semana que contém `moment`, como no date_trunc. */
export function startOfWeek(moment: Date): Date {
  const start = new Date(
    Date.UTC(moment.getUTCFullYear(), moment.getUTCMonth(), moment.getUTCDate()),
  );
  // getUTCDay: 0 é domingo. A semana do PostgreSQL começa na segunda.
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Semanas do ciclo até `now`, inclusive a corrente.
 *
 * `completedOnly` devolve só as semanas já encerradas — é o que decide consumo
 * de bloqueio, que não pode acontecer numa semana ainda em curso.
 */
export function cycleWeeks(
  cycleStart: Date,
  cycleEnd: Date,
  now: Date,
  options: { completedOnly?: boolean } = {},
): CycleWeek[] {
  const weeks: CycleWeek[] = [];
  const last = startOfWeek(new Date(Math.min(now.getTime(), cycleEnd.getTime())));

  for (
    let start = startOfWeek(cycleStart);
    start.getTime() <= last.getTime();
    start = new Date(start.getTime() + WEEK_MS)
  ) {
    const end = new Date(Math.min(start.getTime() + WEEK_MS, cycleEnd.getTime()));
    if (end.getTime() <= start.getTime()) break;
    if (options.completedOnly && end.getTime() > now.getTime()) break;
    const days = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
    weeks.push({ start, end, goal: calculateWeeklyGoal(days) });
  }

  return weeks;
}

/** Quantas aprovações caíram em cada semana. */
export function countByWeek(weeks: CycleWeek[], approvedAt: Date[]): number[] {
  return weeks.map(
    (week) =>
      approvedAt.filter(
        (moment) =>
          moment.getTime() >= week.start.getTime() && moment.getTime() < week.end.getTime(),
      ).length,
  );
}

/** Chave estável da semana (AAAA-MM-DD), usada em consumido_semana. */
export function weekKey(week: CycleWeek): string {
  return week.start.toISOString().slice(0, 10);
}
