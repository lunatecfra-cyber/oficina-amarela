"use client";

import { type Candidate, getCandidate } from "@/lib/candidates";
import { type Mission, type Pauta, STATUS_LABEL } from "@/lib/missions";

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

export function StatusBadge({ status }: { status: Mission["status"] | Pauta["status"] | string }) {
  const s = String(status);
  const color =
    s === "mine" || s === "minha"
      ? "border-gold-lo/60 bg-gold/10 text-gold-hi"
      : s === "available" || s === "disponivel"
        ? "border-line bg-surface-2 text-muted"
        : s === "offered" || s === "oferecida" || s === "ofertada"
          ? "border-gold-lo/40 bg-gold/[0.07] text-gold-hi"
          : s === "reserved" || s === "reservada"
            ? "border-silver-hi/40 bg-silver-hi/5 text-silver-hi"
            : s === "in_review" || s === "em_revisao"
              ? "border-silver-lo/50 bg-surface-2 text-silver"
              : s === "approved" ||
                  s === "completed" ||
                  s === "finished" ||
                  s === "finalized" ||
                  s === "aprovada" ||
                  s === "finalizada"
                ? "border-ok/50 bg-ok/10 text-ok"
                : s === "revision_requested" || s === "reedit" || s === "reedicao"
                  ? "border-danger/50 bg-danger/10 text-danger"
                  : "border-line bg-surface text-muted-2";

  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${color}`}>
      {STATUS_LABEL[s as keyof typeof STATUS_LABEL] ?? s}
    </span>
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
