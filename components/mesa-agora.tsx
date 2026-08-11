"use client";

import { useEffect, useState } from "react";
import type { TrabalhoEmMaos } from "@/lib/agenda";
import { ROTULO_FORMATO } from "@/lib/pautas";

function fmtRestante(ms: number) {
  if (ms <= 0) return "prazo vencido";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function corUrgencia(ms: number) {
  if (ms <= 0) return "text-danger";
  const h = ms / 3_600_000;
  if (h < 4) return "text-danger";
  if (h < 12) return "text-gold-hi";
  return "text-muted";
}

export function MesaAgora({
  trabalhos,
  variant = "cards",
}: {
  /** o que o editor tem em mãos agora — vem do banco, pelo server component */
  trabalhos: TrabalhoEmMaos[];
  variant?: "cards" | "lista";
}) {
  const [agora, setAgora] = useState<number | null>(null);

  useEffect(() => {
    setAgora(Date.now());
    const id = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const calc = (t: TrabalhoEmMaos) => {
    if (agora === null) return { pct: 0, restanteMs: null as number | null };
    const inicio = new Date(t.inicioIso).getTime();
    const prazo = new Date(t.prazoIso).getTime();
    const total = prazo - inicio;
    const pct = Math.min(100, Math.max(0, Math.round(((agora - inicio) / total) * 100)));
    return { pct, restanteMs: prazo - agora };
  };

  if (trabalhos.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nada na mesa agora. Pegue uma missão na fila.
      </p>
    );
  }

  if (variant === "lista") {
    return (
      <ul className="flex flex-col gap-3">
        {trabalhos.map((t) => {
          const { restanteMs } = calc(t);
          return (
            <li key={t.id} className="flex items-center gap-3">
              <span className="grid h-8 w-8 flex-none place-items-center rounded-lg border border-line bg-ink-2 text-gold">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text">{t.titulo}</p>
                <p className="text-xs text-muted-2">
                  {t.etapa} ·{" "}
                  {restanteMs === null ? (
                    <span>—</span>
                  ) : (
                    <span className={corUrgencia(restanteMs)}>
                      faltam {fmtRestante(restanteMs)}
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
      {trabalhos.map((t) => {
        const { pct, restanteMs } = calc(t);
        const apertado = restanteMs !== null && restanteMs < 4 * 3_600_000;
        return (
          <li key={t.id} className="rounded-2xl border border-line bg-surface/60 p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted">{t.portaVoz}</span>
              <span className="rounded-md border border-line bg-ink-2 px-2 py-0.5 text-[11px] text-muted">
                {ROTULO_FORMATO[t.formato]}
              </span>
            </div>

            <h3 className="mt-2 font-[family-name:var(--font-display)] text-lg font-semibold text-text">
              {t.titulo}
            </h3>

            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="text-muted">{t.etapa}</span>
              <span className="text-muted-2">{agora === null ? "—" : `${pct}% do prazo`}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className={`h-full rounded-full ${
                  apertado
                    ? "bg-gradient-to-r from-[#c85a5a] to-[#e08a8a]"
                    : "bg-gradient-to-r from-gold-lo to-gold-hi"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <p className="mt-4 text-sm">
              <span className="text-muted-2">Prazo: </span>
              {restanteMs === null ? (
                <span className="text-muted">—</span>
              ) : (
                <span className={corUrgencia(restanteMs)}>⏳ {fmtRestante(restanteMs)} restantes</span>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
