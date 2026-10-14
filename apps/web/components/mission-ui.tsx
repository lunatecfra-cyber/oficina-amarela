"use client";

import { type Candidate, getCandidate } from "@oficina/domain/candidates";
import { type Mission, type Pauta, STATUS_LABEL } from "@oficina/domain/missions";

export function candidateFromMission(
  p: Mission | Pauta,
  map: Record<string, Candidate>,
): Candidate {
  const handle = p.spokespersonHandle ?? (p as any).portaVozApelido;
  const name = p.spokesperson ?? (p as any).portaVoz;
  if (handle && map[handle]) return map[handle];
  return getCandidate(name);
}

export { candidateFromMission as candidateOfMission, candidateFromMission as candidatoDaPauta };

const TONES = {
  gold: "border-gold-lo/60 bg-gold/10 text-gold-hi",
  soft: "border-gold-lo/40 bg-gold/[0.07] text-gold-hi",
  ok: "border-ok/50 bg-ok/10 text-ok",
  danger: "border-danger/50 bg-danger/10 text-danger",
  silver: "border-silver-hi/40 bg-silver-hi/5 text-silver-hi",
  quiet: "border-silver-lo/50 bg-surface-2 text-silver",
  muted: "border-line bg-surface-2 text-muted",
  dim: "border-line bg-surface text-muted-2",
} as const;

export type PillTone = keyof typeof TONES;

/** Indicador de estado/atenção: o mesmo desenho em fila, painel e cartões. */
export function Pill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, PillTone> = {
  mine: "gold",
  minha: "gold",
  available: "muted",
  disponivel: "muted",
  offered: "soft",
  oferecida: "soft",
  ofertada: "soft",
  reserved: "silver",
  reservada: "silver",
  in_review: "quiet",
  em_revisao: "quiet",
  approved: "ok",
  completed: "ok",
  finished: "ok",
  finalized: "ok",
  aprovada: "ok",
  finalizada: "ok",
  revision_requested: "danger",
  reedit: "danger",
  reedicao: "danger",
};

export function StatusBadge({
  status,
  label,
}: {
  status: Mission["status"] | Pauta["status"] | string;
  /** Texto próprio, quando o papel da tela pede outro rótulo que o do domínio. */
  label?: string;
}) {
  const s = String(status);
  return (
    <Pill tone={STATUS_TONE[s] ?? "dim"}>
      {label ?? STATUS_LABEL[s as keyof typeof STATUS_LABEL] ?? s}
    </Pill>
  );
}

export { StatusBadge as Badge, StatusBadge as Selo };

export function Chip({ k, v }: { k: string; v: string }) {
  return (
    <span className="rounded-md border border-line-soft bg-surface px-2 py-0.5 text-[11px] text-muted">
      <span className="text-muted-2">{k}:</span> {v}
    </span>
  );
}
