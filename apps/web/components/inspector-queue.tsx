"use client";
import { isLikelyUrl } from "@oficina/domain/validators";
import { useCallback, useEffect, useState } from "react";
import { inspectionDate as date, inspectionWait } from "@/lib/inspection-time";

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

export function InspectorQueue() {
  const [items, setItems] = useState<QueueItem[]>([]),
    [filter, setFilter] = useState("em_revisao"),
    [review, setReview] = useState<Review | null>(null),
    [selected, setSelected] = useState<QueueItem | null>(null),
    [notes, setNotes] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/inspections");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setItems(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível carregar a fila.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function open(item: QueueItem) {
    setBusy(true);
    setError("");
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
      setNotice("Entrega carregada abaixo da fila. Confira o histórico e registre a decisão.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível abrir a entrega.");
    } finally {
      setBusy(false);
    }
  }
  async function decide(action: "approve" | "re_edit") {
    if (!selected || !review) return;
    if (!notes.trim()) {
      setError("Registre o motivo da decisão técnica.");
      return;
    }
    setBusy(true);
    setError("");
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
      setError(error instanceof Error ? error.message : "Não foi possível registrar a decisão.");
    } finally {
      setBusy(false);
    }
  }
  const visible = items.filter((item) => filter === "all" || item.status === filter);
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold text-text">Fila de inspeção técnica</h1>
      <p className="mt-2 text-sm text-muted">
        Assuma uma versão, confira o vídeo e registre sua decisão. A avaliação pública pertence ao
        porta-voz.
      </p>
      <p className="mt-2 text-xs text-muted">
        Staging exige inspeção de todas as entregas. A amostragem e os parâmetros definitivos de
        risco ainda aguardam decisão.
      </p>
      <div className="mt-5 flex flex-wrap gap-3" data-guia="inspection-queue">
        <label className="text-sm text-text">
          Status
          <select
            className="field-input mt-1"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            {Object.entries(STATUS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            <option value="all">Todos</option>
          </select>
        </label>
        <button
          className="btn-ghost"
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
      {error && (
        <p role="alert" className="mt-4 text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-ok">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status" className="mt-6 text-muted">
          Carregando inspeções…
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">{visible.length} entrega(s)</p>
          {visible.length === 0 ? (
            <p className="mt-5 rounded-xl border border-line p-5 text-muted">
              Nenhuma entrega neste status. Atualize a fila ou consulte outro filtro.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {visible.map((item) => (
                <li key={item.id} className="rounded-xl border border-line p-4">
                  <h2 className="text-lg text-text">
                    {item.title} · versão {item.version}
                  </h2>
                  <p className="text-sm text-gold">{STATUS[item.status]}</p>
                  <p className="mt-2 text-sm text-muted">
                    Entregue por {item.submittedBy} em {date(item.submittedAt)} ·{" "}
                    {inspectionWait(item.submittedAt)}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Motivo: {REASONS[item.reason] ?? "Inspeção obrigatória"} · Prazo:{" "}
                    {date(item.deadline)}
                  </p>
                  <button className="btn-gold mt-3" disabled={busy} onClick={() => void open(item)}>
                    {busy
                      ? "Aguarde…"
                      : item.status === "em_revisao"
                        ? item.assignedInspectorId === null
                          ? "Assumir e inspecionar"
                          : "Continuar inspeção"
                        : "Ver histórico técnico"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {review && selected && (
        <section
          aria-label="Inspeção da versão"
          data-guia="inspection-decision"
          className="mt-6 rounded-xl border border-gold p-5"
        >
          <h2 className="text-xl text-text">
            {review.mission.title} · versão {review.mission.deliveryVersion}
          </h2>
          <dl className="mt-3 text-sm text-muted">
            {Object.entries(review.mission.brief ?? {}).map(([key, value]) => (
              <div key={key}>
                <dt className="font-medium">
                  {(
                    { tone: "Tom", color: "Cor", font: "Fonte", refs: "Referências" } as Record<
                      string,
                      string
                    >
                  )[key] ?? "Orientação"}
                </dt>
                <dd>{typeof value === "string" ? value : "—"}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-4 space-y-3">
            {review.history.map((version) => (
              <li key={version.version} className="border-t border-line py-3 text-sm text-muted">
                <p>
                  Versão {version.version} · {date(version.submittedAt)}
                </p>
                {(version.videoUrl || version.link) &&
                  isLikelyUrl(version.videoUrl || version.link || "") && (
                    <a
                      className="tap-target text-gold"
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
                    por {version.inspector} em {version.inspectedAt && date(version.inspectedAt)} ·{" "}
                    {version.comment ?? "Sem observação histórica"}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {selected.status === "em_revisao" && (
            <>
              <label className="mt-4 block text-sm text-text" htmlFor="inspection-notes">
                Motivo da decisão
                <textarea
                  id="inspection-notes"
                  className="field-input mt-2 min-h-24"
                  maxLength={2000}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <button className="btn-gold" disabled={busy} onClick={() => void decide("approve")}>
                  {busy ? "Registrando…" : "Aprovar tecnicamente"}
                </button>
                <button
                  className="btn-ghost"
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
    </div>
  );
}
