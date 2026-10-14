"use client";
import { isLikelyUrl } from "@oficina/domain/validators";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Pill, StatusBadge } from "@/components/mission-ui";
import {
  inspectionAttention,
  inspectionDate as date,
  inspectionWait,
  inspectionWaitShort,
  sortInspectionQueue,
} from "@/lib/inspection-time";

type QueueItem = {
  id: number;
  title: string;
  status: string;
  version: number;
  reason: string;
  deadline: string | null;
  submittedAt: string | null;
  submittedBy: string;
  assignedInspectorId: number | null;
};
type Review = {
  mission: {
    id: string;
    title: string;
    brief: Record<string, unknown>;
    deliveryVersion: number;
    deliveryLink?: string;
    deliveryVideoUrl?: string;
  };
  history: {
    version: number;
    submittedAt: string | null;
    link: string | null;
    videoUrl: string | null;
    decision: string | null;
    comment: string | null;
    inspectedAt: string | null;
    inspector: string | null;
  }[];
};
const REASONS: Record<string, string> = {
  first_three_deliveries: "Primeiras três entregas de iniciante",
  invited_first_delivery: "Primeira entrega de experiente convidado",
  critical: "Entrega crítica ou sinalizada",
  risk: "Histórico de problemas",
  sampling: "Amostragem",
  staging_mandatory: "Todas as entregas inspecionadas em staging",
  parameters_pending: "Parâmetros de risco pendentes",
};
const STATUS: Record<string, string> = {
  em_revisao: "Aguardando inspeção",
  reedicao: "Editor corrigindo",
  aprovada: "Aguardando porta-voz",
  finalizada: "Concluída",
};
const BRIEF_LABELS: Record<string, string> = {
  tone: "Tom",
  color: "Cor",
  font: "Fonte",
  refs: "Referências",
};
const EMPTY_TEXT: Record<string, string> = {
  em_revisao: "Nenhuma entrega aguardando inspeção.",
  reedicao: "Nenhum editor corrigindo agora.",
  aprovada: "Nenhuma entrega aguardando o porta-voz.",
  finalizada: "Nenhuma entrega concluída ainda.",
  all: "A fila ainda não tem entregas.",
};

function Tile({
  value,
  label,
  highlight,
}: {
  value: string | number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line-soft bg-surface/40 px-3 py-3">
      <p
        className={`font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums ${
          highlight && Number(value) > 0 ? "text-gold" : "text-text"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs uppercase leading-tight tracking-[0.1em] text-muted-2">
        {label}
      </p>
    </div>
  );
}

export function InspectorQueue() {
  const [items, setItems] = useState<QueueItem[]>([]),
    [filter, setFilter] = useState("em_revisao"),
    [review, setReview] = useState<Review | null>(null),
    [selected, setSelected] = useState<QueueItem | null>(null),
    [notes, setNotes] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [decisionError, setDecisionError] = useState(""),
    [notice, setNotice] = useState(""),
    [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/inspections");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setItems(data);
      setLoadedAt(new Date());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível carregar a fila.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  // Abrir uma entrega leva a pessoa ao painel de decisão; decidir, de volta ao aviso.
  useEffect(() => {
    if (!review) return;
    panelRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    panelRef.current?.focus({ preventScroll: true });
  }, [review]);
  useEffect(() => {
    if (notice) noticeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [notice]);
  async function open(item: QueueItem) {
    setBusy(true);
    setError("");
    setDecisionError("");
    setReview(null);
    setSelected(null);
    setNotes("");
    setNotice("");
    try {
      if (item.status === "em_revisao" && item.assignedInspectorId === null) {
        const claim = await fetch(`/api/inspections/${item.id}/claim`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ version: item.version }),
        });
        if (!claim.ok) throw new Error((await claim.json()).error);
      }
      const response = await fetch(`/api/inspections/${item.id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setReview(data);
      setSelected(item);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível abrir a entrega.");
    } finally {
      setBusy(false);
    }
  }
  async function decide(action: "approve" | "re_edit") {
    if (!selected || !review) return;
    if (!notes.trim()) {
      setDecisionError("Registre o motivo da decisão técnica.");
      return;
    }
    setBusy(true);
    setDecisionError("");
    try {
      const response = await fetch(`/api/missions/db-${selected.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          notes,
          feedback: notes,
          expectedDeliveryVersion: review.mission.deliveryVersion,
        }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      setReview(null);
      setSelected(null);
      setNotes("");
      setNotice(
        action === "approve"
          ? "Inspeção aprovada. A entrega aguarda a conferência do porta-voz."
          : "Ajustes registrados. Aguarde a nova versão do editor.",
      );
      await load();
    } catch (error) {
      setDecisionError(
        error instanceof Error ? error.message : "Não foi possível registrar a decisão.",
      );
    } finally {
      setBusy(false);
    }
  }
  const awaiting = items.filter((item) => item.status === "em_revisao");
  const unclaimed = awaiting.filter((item) => item.assignedInspectorId === null).length;
  const attentionCount = awaiting.filter(
    (item) => inspectionAttention(item).level !== "none",
  ).length;
  const oldest = awaiting.reduce<string | null>((best, item) => {
    const at =
      item.submittedAt && Number.isFinite(Date.parse(item.submittedAt)) ? item.submittedAt : null;
    return at && (!best || Date.parse(at) < Date.parse(best)) ? at : best;
  }, null);
  const visible = sortInspectionQueue(
    items.filter((item) => filter === "all" || item.status === filter),
  );
  const filters = [...Object.entries(STATUS), ["all", "Todos"]];
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-10">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
        Fila de inspeção técnica
      </h1>
      <p className="mt-1 text-sm text-muted">
        Assuma uma versão, confira o vídeo e registre sua decisão. A avaliação pública pertence ao
        porta-voz.
      </p>
      <p className="mt-1 text-xs text-muted-2">
        Staging exige inspeção de todas as entregas. A amostragem e os parâmetros definitivos de
        risco ainda aguardam decisão.
      </p>

      {!loading && !error && (
        <section aria-label="Resumo da fila" className="mt-6 grid grid-cols-3 gap-2">
          <Tile value={awaiting.length} label="aguardando" highlight />
          <Tile value={unclaimed} label="sem inspetor" highlight />
          <Tile value={inspectionWaitShort(oldest)} label="mais antiga" />
        </section>
      )}
      {attentionCount > 0 && (
        <p className="mt-4 rounded-xl border border-gold-lo/50 bg-gold/[0.07] px-4 py-3 text-sm font-medium text-gold-hi">
          {attentionCount === 1
            ? "1 entrega pede atenção: prazo vencido, vence hoje ou espera longa."
            : `${attentionCount} entregas pedem atenção: prazo vencido, vence hoje ou espera longa.`}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2" data-guia="inspection-queue">
        <div role="group" aria-label="Filtrar por status" className="flex flex-wrap gap-2">
          {filters.map(([value, label]) => {
            const count =
              value === "all" ? items.length : items.filter((i) => i.status === value).length;
            const active = filter === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(value)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${
                  active
                    ? "border-gold-lo bg-gold/10 text-gold-hi"
                    : "border-line bg-surface text-muted hover:border-gold/30 hover:text-text"
                }`}
              >
                {label}
                <span className="tabular-nums text-xs opacity-80">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {loadedAt && !loading && (
            <span className="hidden text-xs text-muted-2 sm:inline">
              Atualizada às{" "}
              {loadedAt.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Sao_Paulo",
              })}
            </span>
          )}
          <button
            type="button"
            className="btn-ghost w-auto px-4"
            disabled={loading || busy}
            onClick={() => {
              setReview(null);
              setSelected(null);
              void load();
            }}
          >
            Atualizar fila
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-danger/50 bg-danger/10 p-4">
          <p className="text-sm text-danger">{error}</p>
          <button type="button" className="btn-ghost mt-3 w-auto px-4" onClick={() => void load()}>
            Tentar de novo
          </button>
        </div>
      )}
      {notice && (
        <p
          ref={noticeRef}
          role="status"
          className="mt-4 rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok"
        >
          {notice}
        </p>
      )}

      {loading ? (
        <div role="status" aria-label="Carregando inspeções" className="mt-6 grid gap-3">
          {[0, 1, 2].map((n) => (
            <div
              key={n}
              className="h-32 animate-pulse rounded-2xl border border-line-soft bg-surface/40"
            />
          ))}
        </div>
      ) : (
        !error && (
          <>
            <p className="mt-6 text-sm text-muted">{visible.length} entrega(s)</p>
            {visible.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  title={EMPTY_TEXT[filter] ?? EMPTY_TEXT.all}
                  description="Quando um editor entregar uma versão, ela aparece aqui. Use Atualizar fila para conferir."
                />
              </div>
            ) : (
              <ul className="mt-3 grid gap-3">
                {visible.map((item) => {
                  const attention = inspectionAttention(item);
                  const isOpen = selected?.id === item.id && review;
                  return (
                    <li
                      key={`${item.id}-${item.version}`}
                      className={`rounded-2xl border border-l-[3px] bg-surface/50 p-4 lg:p-5 ${
                        attention.level === "high"
                          ? "border-danger/40 border-l-danger"
                          : attention.level === "medium"
                            ? "border-gold-lo/50 border-l-gold"
                            : "border-line border-l-line"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                        <h2 className="min-w-0 flex-1 font-[family-name:var(--font-display)] text-base font-semibold leading-snug text-text lg:text-lg">
                          {item.title} · versão {item.version}
                        </h2>
                        <div className="flex flex-wrap gap-1.5">
                          {attention.reasons.map((reason) => (
                            <Pill
                              key={reason}
                              tone={attention.level === "high" ? "danger" : "gold"}
                            >
                              {reason}
                            </Pill>
                          ))}
                          <StatusBadge status={item.status} label={STATUS[item.status]} />
                          {item.status === "em_revisao" && (
                            <Pill tone="muted">
                              {item.assignedInspectorId === null ? "Sem inspetor" : "Já assumida"}
                            </Pill>
                          )}
                        </div>
                      </div>
                      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-xs text-muted-2">Entregue por</dt>
                          <dd className="text-muted">
                            {item.submittedBy} · {date(item.submittedAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-2">Tempo de espera</dt>
                          <dd className="text-muted">{inspectionWait(item.submittedAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-2">Por que foi para inspeção</dt>
                          <dd className="text-muted">
                            {REASONS[item.reason] ?? "Inspeção obrigatória"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-2">Prazo do porta-voz</dt>
                          <dd className="text-muted">{date(item.deadline)}</dd>
                        </div>
                      </dl>
                      <button
                        type="button"
                        className="btn-gold mt-4 sm:w-auto sm:px-6"
                        disabled={busy}
                        onClick={() => void open(item)}
                      >
                        {busy
                          ? "Aguarde…"
                          : item.status === "em_revisao"
                            ? item.assignedInspectorId === null
                              ? "Assumir e inspecionar"
                              : "Continuar inspeção"
                            : "Ver histórico técnico"}
                      </button>

                      {isOpen && review && (
                        <section
                          ref={panelRef}
                          tabIndex={-1}
                          aria-label="Inspeção da versão"
                          data-guia="inspection-decision"
                          className="mt-5 scroll-mt-4 rounded-xl border border-gold p-4 outline-none lg:p-5"
                        >
                          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text">
                            Conferir a entrega · versão {review.mission.deliveryVersion}
                          </h3>
                          <dl className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-2">
                            {Object.entries(review.mission.brief ?? {})
                              .filter(([, value]) => typeof value === "string" && value.trim())
                              .map(([key, value]) => (
                                <div key={key}>
                                  <dt className="text-xs text-muted-2">
                                    {BRIEF_LABELS[key] ?? "Orientação"}
                                  </dt>
                                  <dd>{String(value)}</dd>
                                </div>
                              ))}
                          </dl>
                          <ul className="mt-4 space-y-1">
                            {review.history.map((version) => (
                              <li
                                key={version.version}
                                className="border-t border-line py-3 text-sm text-muted"
                              >
                                <p>
                                  Versão {version.version} · {date(version.submittedAt)}
                                </p>
                                {(version.videoUrl || version.link) &&
                                  isLikelyUrl(version.videoUrl || version.link || "") && (
                                    <a
                                      className="tap-target -ml-3 text-gold-hi underline"
                                      href={version.videoUrl || version.link || ""}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Abrir vídeo da versão {version.version}
                                    </a>
                                  )}
                                {version.decision && (
                                  <p>
                                    {version.decision === "approved"
                                      ? "Aprovada tecnicamente"
                                      : "Ajustes solicitados"}{" "}
                                    por {version.inspector} em{" "}
                                    {version.inspectedAt && date(version.inspectedAt)} ·{" "}
                                    {version.comment ?? "Sem observação histórica"}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                          {selected?.status === "em_revisao" && (
                            <>
                              <label
                                className="mt-4 block text-sm font-medium text-text"
                                htmlFor="inspection-notes"
                              >
                                Motivo da decisão
                                <span className="block text-xs font-normal text-muted-2">
                                  Obrigatório para aprovar ou pedir ajustes; o editor e o porta-voz
                                  leem este texto.
                                </span>
                                <textarea
                                  id="inspection-notes"
                                  className="field-input mt-2 min-h-24 !pl-4 font-normal"
                                  maxLength={2000}
                                  aria-describedby={decisionError ? "inspection-error" : undefined}
                                  value={notes}
                                  onChange={(event) => {
                                    setNotes(event.target.value);
                                    setDecisionError("");
                                  }}
                                />
                              </label>
                              {decisionError && (
                                <p
                                  id="inspection-error"
                                  role="alert"
                                  className="mt-2 text-sm text-danger"
                                >
                                  {decisionError}
                                </p>
                              )}
                              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                                <button
                                  type="button"
                                  className="btn-gold sm:w-auto sm:px-6"
                                  disabled={busy}
                                  onClick={() => void decide("approve")}
                                >
                                  {busy ? "Registrando…" : "Aprovar tecnicamente"}
                                </button>
                                <button
                                  type="button"
                                  className="btn-ghost sm:w-auto sm:px-6"
                                  disabled={busy}
                                  onClick={() => void decide("re_edit")}
                                >
                                  Solicitar ajustes
                                </button>
                              </div>
                            </>
                          )}
                        </section>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )
      )}
    </div>
  );
}
