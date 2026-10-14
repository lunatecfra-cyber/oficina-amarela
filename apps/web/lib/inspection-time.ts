const HOUR = 3_600_000;

export function inspectionDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Não informado";
  const date = new Date(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? date.toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Horas inteiras de espera; datas futuras valem 0. `null` quando a data é desconhecida. */
function waitedHours(value: string | null, now: number) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return Math.max(0, Math.floor((now - Date.parse(value)) / HOUR));
}

export function inspectionWait(value: string | null, now = Date.now()) {
  const hours = waitedHours(value, now);
  if (hours === null) return "Tempo de espera não informado";
  if (hours === 0) return "Há menos de uma hora";
  return hours < 48 ? `Há ${hours} hora(s)` : `Há ${Math.floor(hours / 24)} dia(s)`;
}

/** Versão curta para os números do resumo da fila. */
export function inspectionWaitShort(value: string | null, now = Date.now()) {
  const hours = waitedHours(value, now);
  if (hours === null) return "—";
  if (hours === 0) return "< 1 h";
  return hours < 48 ? `${hours} h` : `${Math.floor(hours / 24)} dias`;
}

export type InspectionAttention = { level: "high" | "medium" | "none"; reasons: string[] };

type QueueSignals = { status: string; submittedAt: string | null; deadline: string | null };

const saoPauloDay = (ms: number) =>
  new Date(ms).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/**
 * O que pede atenção numa entrega que aguarda inspeção. São sinais visuais da fila,
 * não regra de SLA: amostragem, critérios de risco e prazos definitivos seguem
 * pendentes, então nada aqui bloqueia ou prioriza a decisão técnica.
 */
export function inspectionAttention(item: QueueSignals, now = Date.now()): InspectionAttention {
  if (item.status !== "em_revisao") return { level: "none", reasons: [] };
  const reasons: string[] = [];
  let level: InspectionAttention["level"] = "none";
  if (item.deadline && Number.isFinite(Date.parse(item.deadline))) {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(item.deadline)
      ? item.deadline
      : saoPauloDay(Date.parse(item.deadline));
    const today = saoPauloDay(now);
    if (day < today) {
      reasons.push("Prazo vencido");
      level = "high";
    } else if (day === today) {
      reasons.push("Prazo vence hoje");
      level = "medium";
    }
  }
  const hours = waitedHours(item.submittedAt, now);
  if (hours !== null && hours >= 24) {
    reasons.push("Aguarda há mais de um dia");
    if (level === "none") level = "medium";
  }
  return { level, reasons };
}

/** Atenção primeiro; entre aguardando, a mais antiga primeiro; no histórico, a mais nova. */
export function sortInspectionQueue<T extends QueueSignals>(items: T[], now = Date.now()): T[] {
  const rank = { high: 0, medium: 1, none: 2 } as const;
  const at = (value: string | null) =>
    value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  return [...items].sort((a, b) => {
    const byAttention =
      rank[inspectionAttention(a, now).level] - rank[inspectionAttention(b, now).level];
    if (byAttention !== 0) return byAttention;
    const [x, y] = [at(a.submittedAt), at(b.submittedAt)];
    if (x === y) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return a.status === "em_revisao" && b.status === "em_revisao" ? x - y : y - x;
  });
}
