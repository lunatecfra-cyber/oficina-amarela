import type { Mission, VideoFormat } from "./missions.ts";

export type ActiveWork = {
  id: string;
  title: string;
  spokesperson: string;
  format: VideoFormat;
  startIso: string;
  deadlineIso?: string;
  stage: string;
  tone?: string;
  color?: string;
  font?: string;
  refs?: string;
  driveLink?: string;
  youtubeLink?: string;
  desiredDeadline?: string;
  // compatibility aliases
  titulo?: string;
  portaVoz?: string;
  formato?: VideoFormat;
  inicioIso?: string;
  prazoIso?: string;
  etapa?: string;
  tom?: string;
  cor?: string;
  fonte?: string;
  prazoDesejado?: string;
};

export type TaskOnDesk = ActiveWork;
export type TrabalhoEmMaos = ActiveWork;

const STAGE_BY_STATUS: Record<string, string> = {
  reserved: "Na sua mesa",
  reservada: "Na sua mesa",
  mine: "Na sua mesa",
  minha: "Na sua mesa",
  in_review: "Em revisão",
  em_revisao: "Em revisão",
  revision_requested: "Ajuste pedido",
  reedicao: "Ajuste pedido",
};

export function activeWorkFromMission(m: Mission | null): ActiveWork[] {
  if (!m) return [];
  const start = m.reservedAt ?? (m as any).reservadaEm ?? new Date().toISOString();
  const title = m.title ?? (m as any).titulo ?? "";
  const spokesperson = m.spokesperson ?? (m as any).portaVoz ?? "";
  const format = m.format ?? (m as any).formato ?? "short";
  const brief = m.brief ?? {};
  const tone = brief.tone ?? (brief as any).tom;
  const color = brief.color ?? (brief as any).cor;
  const font = brief.font ?? (brief as any).fonte;
  const refs = brief.refs;
  const desiredDeadline = m.desiredDeadline ?? (m as any).prazoDesejado;

  return [
    {
      id: m.id,
      title,
      spokesperson,
      format,
      startIso: start,
      stage: STAGE_BY_STATUS[m.status] ?? "With you",
      tone,
      color,
      font,
      refs,
      driveLink: m.driveLink,
      youtubeLink: m.youtubeLink,
      desiredDeadline,
      // aliases
      titulo: title,
      portaVoz: spokesperson,
      formato: format,
      inicioIso: start,
      etapa: STAGE_BY_STATUS[m.status] ?? "With you",
      tom: tone,
      cor: color,
      fonte: font,
      prazoDesejado: desiredDeadline,
    },
  ];
}

export function currentGridBlock(d = new Date()): {
  period: number;
  day: number;
  periodo?: number;
  dia?: number;
} {
  const day = (d.getDay() + 6) % 7;
  const h = d.getHours();
  const period = h >= 6 && h < 12 ? 0 : h >= 12 && h < 18 ? 1 : 2;
  return { period, day, periodo: period, dia: day };
}

export const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export const PERIODS = ["Manhã", "Tarde", "Noite"];

export const DEFAULT_AVAILABILITY: boolean[][] = [
  [false, true, false, true, false, false, false],
  [true, true, true, true, true, false, false],
  [true, false, true, false, true, true, false],
];
