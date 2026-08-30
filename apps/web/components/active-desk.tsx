"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FORMAT_LABEL } from "@/lib/missions";
import type { TaskOnDesk } from "@/lib/schedule";
import { looksLikeDriveLink, looksLikeYoutubeLink } from "@/lib/validators";

function fmtRemaining(ms: number) {
  if (ms <= 0) return "prazo vencido";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function urgencyColor(ms: number) {
  if (ms <= 0) return "text-danger";
  const h = ms / 3_600_000;
  if (h < 4) return "text-danger";
  if (h < 12) return "text-gold-hi";
  return "text-muted";
}

function Chip({ k, v }: { k: string; v: string }) {
  return (
    <span className="rounded-md border border-line-soft bg-surface px-2 py-0.5 text-[11px] text-muted">
      <span className="text-muted-2">{k}:</span> {v}
    </span>
  );
}

export function ActiveDesk({
  tasks,
  trabalhos,
  variant = "cards",
}: {
  tasks?: TaskOnDesk[];
  trabalhos?: TaskOnDesk[];
  variant?: "cards" | "lista" | "list";
}) {
  const [now, setNow] = useState<number | null>(null);
  const effectiveTasks = tasks ?? trabalhos ?? [];

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const calc = (t: TaskOnDesk) => {
    if (now === null) return { pct: 0, remainingMs: null as number | null };
    const startIso = t.startIso ?? (t as any).inicioIso;
    const start = new Date(startIso).getTime();
    const deadlineIso = t.deadlineIso ?? (t as any).prazoIso;
    if (!deadlineIso) return { pct: 0, remainingMs: null };
    const deadline = new Date(deadlineIso).getTime();
    const total = deadline - start;
    const pct = Math.min(100, Math.max(0, Math.round(((now - start) / total) * 100)));
    return { pct, remainingMs: deadline - now };
  };

  const fmtSince = (iso: string) => {
    const ms = (now ?? 0) - new Date(iso).getTime();
    const h = Math.max(0, Math.floor(ms / 3_600_000));
    if (h < 1) return "agora mesmo";
    if (h < 24) return `há ${h}h na mesa`;
    const d = Math.floor(h / 24);
    return `há ${d} dia${d > 1 ? "s" : ""} na mesa`;
  };

  if (effectiveTasks.length === 0) {
    return <p className="text-sm text-muted">Nada na mesa agora. Pegue uma missão na fila.</p>;
  }

  if (variant === "list" || variant === "lista") {
    return (
      <ul className="flex flex-col gap-3">
        {effectiveTasks.map((t) => {
          const { remainingMs } = calc(t);
          const title = t.title ?? (t as any).titulo;
          const stage = t.stage ?? (t as any).etapa;
          const startIso = t.startIso ?? (t as any).inicioIso;
          return (
            <li key={t.id} className="flex items-center gap-3">
              <span className="grid h-8 w-8 flex-none place-items-center rounded-lg border border-line bg-ink-2 text-gold">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text">{title}</p>
                <p className="text-xs text-muted-2">
                  {stage} ·{" "}
                  {remainingMs === null ? (
                    <span>{now === null ? "—" : fmtSince(startIso)}</span>
                  ) : (
                    <span className={urgencyColor(remainingMs)}>
                      faltam {fmtRemaining(remainingMs)}
                    </span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {effectiveTasks.map((t) => {
        const { pct, remainingMs } = calc(t);
        const tight = remainingMs !== null && remainingMs < 4 * 3_600_000;
        const hasBrief =
          t.tone ||
          t.color ||
          t.font ||
          t.refs ||
          (t as any).tom ||
          (t as any).cor ||
          (t as any).fonte;
        const title = t.title ?? (t as any).titulo;
        const spokesperson = t.spokesperson ?? (t as any).portaVoz;
        const format = t.format ?? (t as any).formato ?? "short";
        const stage = t.stage ?? (t as any).etapa;
        const startIso = t.startIso ?? (t as any).inicioIso;
        const desiredDeadline = t.desiredDeadline ?? (t as any).prazoDesejado;
        const driveLink = t.driveLink;
        const youtubeLink = t.youtubeLink;

        return (
          <li key={t.id} className="rounded-2xl border border-line bg-surface/60 p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted">{spokesperson}</span>
              <span className="rounded-full border border-line bg-ink-2 px-2.5 py-0.5 text-[11px] font-medium text-muted-2">
                {FORMAT_LABEL[format]}
              </span>
            </div>

            <h3 className="mt-2 font-[family-name:var(--font-display)] text-lg font-semibold text-text">
              {title}
            </h3>

            {hasBrief && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {(t.tone ?? (t as any).tom) && <Chip k="tom" v={(t.tone ?? (t as any).tom)!} />}
                {(t.color ?? (t as any).cor) && <Chip k="cor" v={(t.color ?? (t as any).cor)!} />}
                {(t.font ?? (t as any).fonte) && (
                  <Chip k="fonte" v={(t.font ?? (t as any).fonte)!} />
                )}
                {t.refs && <Chip k="ref" v={t.refs} />}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="text-muted">{stage}</span>
              <span className="text-muted-2">
                {remainingMs === null
                  ? now === null
                    ? "—"
                    : fmtSince(startIso)
                  : `${pct}% do prazo`}
              </span>
            </div>
            {remainingMs !== null && (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className={`h-full rounded-full ${
                    tight
                      ? "bg-gradient-to-r from-[#c85a5a] to-[#e08a8a]"
                      : "bg-gradient-to-r from-gold-lo to-gold-hi"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {remainingMs !== null && (
                <span>
                  <span className="text-muted-2">Prazo: </span>
                  <span className={urgencyColor(remainingMs)}>
                    ⏳ {fmtRemaining(remainingMs)} restantes
                  </span>
                </span>
              )}
              {desiredDeadline && (
                <span className="text-xs text-muted-2">
                  ⏰ Desejado:{" "}
                  {new Date(desiredDeadline).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    timeZone: "UTC",
                  })}
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              {driveLink && looksLikeDriveLink(driveLink) && (
                <a
                  href={driveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-gold-hi hover:underline"
                >
                  📁 Abrir bruto no Drive
                </a>
              )}
              {youtubeLink && looksLikeYoutubeLink(youtubeLink) && (
                <a
                  href={youtubeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-gold-hi hover:underline"
                >
                  ▶ Abrir no YouTube
                </a>
              )}
              <Link
                href="/editor"
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-gold-hi hover:underline"
              >
                Ir pra entrega →
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export { ActiveDesk as MesaAgora };
