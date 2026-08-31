"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { QueueItem, MissionInFlight, Summary, ItemFila, MissaoEmVoo, Resumo } from "@/lib/overview-db";

function sinceWhen(iso: string | null) {
  if (!iso) return "—";
  const midnight = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(new Date()) - midnight(new Date(iso))) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  return months === 1 ? "há 1 mês" : `há ${months} meses`;
}

function idleDays(iso: string | null) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

const FLIGHT_LABELS: Record<string, { text: string; color: string }> = {
  reserved: { text: "em edição", color: "text-gold" },
  reservada: { text: "em edição", color: "text-gold" },
  in_review: { text: "na conferência", color: "text-silver-hi" },
  em_revisao: { text: "na conferência", color: "text-silver-hi" },
  reedit: { text: "em reedição", color: "text-danger" },
  reedicao: { text: "em reedição", color: "text-danger" },
};

function StatNumber({
  value,
  label,
  highlight,
}: {
  value: number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line-soft bg-surface/40 px-3 py-3">
      <p
        className={`font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums ${
          highlight && value > 0 ? "text-gold" : "text-text"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] uppercase leading-tight tracking-[0.1em] text-muted-2">
        {label}
      </p>
    </div>
  );
}

export function OverviewPanel({
  summary,
  queue,
  inFlight,
  // compatibility aliases
  resumo,
  fila,
  emVoo,
}: {
  summary?: Summary;
  queue?: QueueItem[];
  inFlight?: MissionInFlight[];
  resumo?: Resumo;
  fila?: ItemFila[];
  emVoo?: MissaoEmVoo[];
}) {
  const router = useRouter();
  const sum = (summary ?? resumo)!;
  const qList = (queue ?? fila ?? []) as QueueItem[];
  const fList = (inFlight ?? emVoo ?? []) as MissionInFlight[];

  const [queueItems, setQueueItems] = useState(qList);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [notifying, setNotifying] = useState<"editors" | "candidates" | null>(null);
  const [notifiedMsg, setNotifiedMsg] = useState<string>("");
  const [warning, setWarning] = useState("");

  async function move(id: number, movement: "up" | "down" | "top" | "subir" | "descer" | "topo") {
    setMovingId(id);
    setWarning("");

    const normMove = movement === "topo" ? "top" : movement === "subir" ? "up" : movement === "descer" ? "down" : movement;
    const fromIdx = queueItems.findIndex((f) => f.id === id);
    const toIdx = normMove === "top" ? 0 : normMove === "up" ? fromIdx - 1 : fromIdx + 1;
    if (fromIdx >= 0 && toIdx >= 0 && toIdx < queueItems.length) {
      const newList = [...queueItems];
      const [item] = newList.splice(fromIdx, 1);
      newList.splice(toIdx, 0, item);
      setQueueItems(newList);
    }

    const resp = await fetch("/api/admin/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, movement: normMove, movimento: movement }),
    });
    if (!resp.ok) {
      const d = await resp.json().catch(() => null);
      setWarning(d?.error ?? d?.erro ?? "Não deu pra mover.");
    }
    setMovingId(null);
    router.refresh();
  }

  async function deleteMission(id: number) {
    setDeletingId(id);
    setWarning("");

    const resp = await fetch(`/api/admin/missions/${id}`, { method: "DELETE" });
    if (!resp.ok) {
      const d = await resp.json().catch(() => null);
      setWarning(d?.error ?? d?.erro ?? "Não deu pra apagar.");
    } else {
      setConfirmDeleteId(null);
    }
    setDeletingId(null);
    router.refresh();
  }

  async function notify(type: "editors" | "candidates") {
    setNotifying(type);
    setWarning("");
    setNotifiedMsg("");

    const resp = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, tipo: type === "editors" ? "editores" : "candidatos" }),
    });
    if (!resp.ok) {
      const d = await resp.json().catch(() => null);
      setWarning(d?.error ?? d?.erro ?? "Não deu pra enviar.");
    } else {
      const d = await resp.json().catch(() => null);
      const n = d?.sent ?? d?.enviados ?? "?";
      setNotifiedMsg(`${n} e-mail${n !== 1 ? "s" : ""} enviado${n !== 1 ? "s" : ""}.`);
      setTimeout(() => setNotifiedMsg(""), 4000);
    }
    setNotifying(null);
  }

  const inQueueCount = sum.inQueue ?? (sum as any).naFila ?? 0;
  const offeredCount = sum.offered ?? (sum as any).oferecidas ?? 0;
  const inEditingCount = sum.inEditing ?? (sum as any).emEdicao ?? 0;
  const inReviewCount = sum.inReview ?? (sum as any).emConferencia ?? 0;
  const inReeditCount = sum.inReedit ?? (sum as any).emReedicao ?? 0;
  const completedCount = sum.completed ?? (sum as any).concluidas ?? 0;
  const candidatesCount = sum.candidates ?? (sum as any).candidatos ?? 0;
  const editorsCount = sum.editors ?? (sum as any).editores ?? 0;
  const freeEditorsCount = sum.freeEditors ?? (sum as any).editoresLivres ?? 0;
  const bannedCount = sum.banned ?? (sum as any).banidos ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-12">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
        Panorama
      </h1>
      <p className="mt-1 text-sm text-muted">
        Onde está cada missão e quem está livre pra pegar a próxima.
      </p>

      <section className="mt-6" data-guia="numeros-panorama">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-gold">
          Missões
        </h2>
        <button
          type="button"
          onClick={() => notify("editors")}
          disabled={notifying !== null || inQueueCount === 0}
          className="link-toque -ml-3 mb-1 text-xs text-muted hover:text-gold disabled:opacity-40"
          title={inQueueCount === 0 ? "Sem missões na fila" : "Enviar e-mail pra todos os editores"}
        >
          ✉ Avisar editores que há missões na fila
        </button>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <StatNumber value={inQueueCount} label="na fila" highlight />
          <StatNumber value={offeredCount} label="oferecidas" />
          <StatNumber value={inEditingCount} label="em edição" />
          <StatNumber value={inReviewCount} label="conferindo" highlight />
          <StatNumber value={inReeditCount} label="reedição" highlight />
          <StatNumber value={completedCount} label="concluídas" />
        </div>

        <h2 className="mb-3 mt-6 text-xs font-medium uppercase tracking-[0.14em] text-gold">
          Gente
        </h2>
        <button
          type="button"
          onClick={() => notify("candidates")}
          disabled={notifying !== null || freeEditorsCount === 0}
          className="link-toque -ml-3 mb-1 text-xs text-muted hover:text-gold disabled:opacity-40"
          title={freeEditorsCount === 0 ? "Sem editores livres" : "Enviar e-mail pra todos os porta-vozes"}
        >
          ✉ Avisar porta-vozes que há editores livres
        </button>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatNumber value={candidatesCount} label="porta-vozes" />
          <StatNumber value={editorsCount} label="editores" />
          <StatNumber value={freeEditorsCount} label="editores livres" />
          <StatNumber value={bannedCount} label="suspensos" />
        </div>
      </section>

      {warning && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {warning}
        </p>
      )}
      {notifiedMsg && (
        <p className="mt-4 text-sm text-gold-hi">
          {notifiedMsg}
        </p>
      )}

      <section className="mt-10" data-guia="fila-edicao">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-gold">
            Fila de edição
          </h2>
          <span className="text-xs text-muted-2">
            {queueItems.length === 1 ? "1 missão" : `${queueItems.length} missões`}
          </span>
        </div>
        <p className="mb-3 text-xs text-muted">
          Nesta ordem é que o sistema oferece pros editores. Suba o que for
          urgente.
        </p>

        {queueItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
            Ninguém esperando. Toda missão criada já está com um editor.
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {queueItems.map((f, i) => {
              const createdAt = f.createdAt ?? (f as any).criadaEm;
              const idle = idleDays(createdAt);
              const title = f.title ?? (f as any).titulo;
              const candidateName = f.candidateName ?? (f as any).candidato;
              const format = f.format ?? (f as any).formato;
              const status = f.status;
              const offeredTo = f.offeredTo ?? (f as any).oferecidaPara;
              const offeredAt = f.offeredAt ?? (f as any).oferecidaEm;

              return (
                <li
                  key={f.id}
                  className={`rounded-2xl border bg-surface/60 p-3 lg:p-4 ${
                    idle >= 3 ? "border-gold-lo/50" : "border-line"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-lg border border-line bg-ink-2 font-[family-name:var(--font-display)] text-sm font-semibold tabular-nums text-muted">
                      {i + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-[family-name:var(--font-display)] text-base font-semibold leading-snug text-text">
                        {title}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-2">
                        {candidateName} · {format === "short" ? "Short" : "Longo"} ·
                        criada {sinceWhen(createdAt)}
                      </p>
                      {status === "offered" || status === "oferecida" ? (
                        <p className="mt-1 text-xs text-silver">
                          oferecida a <span className="text-text">@{offeredTo}</span>{" "}
                          {sinceWhen(offeredAt)} — esperando resposta
                        </p>
                      ) : (
                        idle >= 3 && (
                          <p className="mt-1 text-xs font-medium text-gold-hi">
                            parada há {idle} dias sem editor
                          </p>
                        )
                      )}
                    </div>
                  </div>

                  {(status === "available" || status === "disponivel") && queueItems.length > 1 && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => move(f.id, "top")}
                        disabled={i === 0 || movingId !== null}
                        className="btn-ghost min-h-11 flex-1 py-2 text-xs disabled:opacity-40"
                      >
                        ↑↑ Topo
                      </button>
                      <button
                        type="button"
                        aria-label={`Subir ${title}`}
                        onClick={() => move(f.id, "up")}
                        disabled={i === 0 || movingId !== null}
                        className="btn-ghost min-h-11 w-14 py-2 text-xs disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Descer ${title}`}
                        onClick={() => move(f.id, "down")}
                        disabled={i === queueItems.length - 1 || movingId !== null}
                        className="btn-ghost min-h-11 w-14 py-2 text-xs disabled:opacity-40"
                      >
                        ↓
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(f.id)}
                    disabled={movingId !== null}
                    className="btn-ghost mt-2 w-full py-1.5 text-xs text-muted hover:text-danger disabled:opacity-40"
                  >
                    Apagar missão
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="mt-10" data-guia="em-voo">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-gold">
            Em andamento
          </h2>
          <span className="text-xs text-muted-2">
            {fList.length === 1 ? "1 missão" : `${fList.length} missões`}
          </span>
        </div>
        <p className="mb-3 text-xs text-muted">
          Saiu da fila e ainda não fechou. A mais parada aparece primeiro.
        </p>

        {fList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
            Nada em andamento agora.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {fList.map((m) => {
              const r = FLIGHT_LABELS[m.status] ?? { text: m.status, color: "text-muted" };
              const since = m.since ?? (m as any).desde;
              const idle = idleDays(since);
              const title = m.title ?? (m as any).titulo;
              const candidateName = m.candidateName ?? (m as any).candidato;
              const editor = m.editor;
              const hasDelivery = m.hasDelivery ?? (m as any).temEntrega;

              return (
                <li
                  key={m.id}
                  className={`rounded-2xl border bg-surface/60 p-3 lg:p-4 ${
                    idle >= 5 ? "border-danger/40" : "border-line"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 className="font-[family-name:var(--font-display)] text-base font-semibold leading-snug text-text">
                      {title}
                    </h3>
                    <span className={`text-xs font-medium ${r.color}`}>{r.text}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-2">
                    {candidateName} · editor{" "}
                    <span className="text-muted">
                      {editor ? `@${editor}` : "—"}
                    </span>{" "}
                    · começou {sinceWhen(since)}
                  </p>
                  {idle >= 5 && (
                    <p className="mt-1 text-xs font-medium text-danger">
                      {idle} dias no mesmo lugar
                    </p>
                  )}
                  {(m.status === "in_review" || m.status === "em_revisao") && hasDelivery && (
                    <Link
                      href="/inspetor"
                      className="mt-2 inline-block text-xs font-medium text-gold-hi hover:underline"
                    >
                      Conferir agora →
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(m.id)}
                    className="mt-2 text-xs text-muted hover:text-danger"
                  >
                    Apagar missão
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {confirmDeleteId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text">
              Apagar missão?
            </h3>
            <p className="mt-2 text-sm text-muted">
              A missão e todo o histórico (chat, avaliações) vão sumir pra
              sempre. Essa ação não tem volta.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="btn-ghost min-h-11 flex-1 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => deleteMission(confirmDeleteId)}
                disabled={deletingId !== null}
                className="btn-danger min-h-11 flex-1 py-2 text-sm disabled:opacity-50"
              >
                {deletingId !== null ? "Apagando…" : "Apagar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { OverviewPanel as PainelPanorama };
