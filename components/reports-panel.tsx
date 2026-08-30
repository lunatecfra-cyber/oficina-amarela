"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { initials } from "@/lib/candidates";
import type { Denuncia, Report } from "@/lib/reports-db";

const STATUS_LABELS: Record<string, { txt: string; cls: string }> = {
  open: { txt: "aberta", cls: "border-danger/40 bg-danger/10 text-danger" },
  aberta: { txt: "aberta", cls: "border-danger/40 bg-danger/10 text-danger" },
  resolved: { txt: "resolvida", cls: "border-ok/40 bg-ok/10 text-ok" },
  resolvida: { txt: "resolvida", cls: "border-ok/40 bg-ok/10 text-ok" },
  ignored: { txt: "ignorada", cls: "border-line text-muted" },
  ignorada: { txt: "ignorada", cls: "border-line text-muted" },
};

const MISSION_STATUS_LABELS: Record<string, string> = {
  available: "na fila",
  disponivel: "na fila",
  offered: "em oferta",
  oferecida: "em oferta",
  reserved: "com editor",
  reservada: "com editor",
  in_review: "em revisão",
  em_revisao: "em revisão",
  reedit: "em reedição",
  reedicao: "em reedição",
  approved: "aprovada",
  aprovada: "aprovada",
  finished: "finalizada",
  finalizada: "finalizada",
};

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReportsPanel({
  reports,
  denuncias,
}: {
  reports?: Report[];
  denuncias?: Denuncia[];
}) {
  const router = useRouter();
  const list = (reports ?? denuncias ?? []) as Report[];
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const openCount = list.filter(
    (d) => d.status === "open" || (d as any).status === "aberta",
  ).length;

  async function handleAction(
    reportId: number,
    action: "resolve" | "ignore" | "resolver" | "ignorar",
  ) {
    setError("");
    setProcessingId(reportId);
    try {
      const normAction =
        action === "resolver" ? "resolve" : action === "ignorar" ? "ignore" : action;
      const resp = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, action: normAction, denunciaId: reportId, acao: action }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        setError(data?.error ?? data?.erro ?? "Não deu pra concluir.");
        return;
      }
      router.refresh();
    } catch {
      setError("Sem conexão. Tenta de novo.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
            Denúncias
          </h1>
          <p className="mt-1 text-sm text-muted">Reclamações que chegaram de dentro das missões.</p>
        </div>
        <p className="text-sm text-muted">
          {openCount} aberta{openCount === 1 ? "" : "s"}
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      {list.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line-soft bg-surface/40 p-10 text-center text-sm text-muted">
          Nenhuma denúncia até agora. Boa notícia.
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {list.map((d) => {
            const reporterName = d.reporterName ?? (d as any).denuncianteNome;
            const reportedName = d.reportedName ?? (d as any).denunciadoNome;
            const reportedHandle = d.reportedHandle ?? (d as any).denunciadoApelido;
            const missionId = d.missionId ?? (d as any).pautaId;
            const missionTitle = d.missionTitle ?? (d as any).pautaTitulo;
            const missionStatus = d.missionStatus ?? (d as any).pautaStatus;
            const text = d.text ?? (d as any).texto;
            const createdAt = d.createdAt ?? (d as any).criadaEm;
            const status = d.status;
            const isOpen = String(status) === "open" || String(status) === "aberta";

            return (
              <li key={d.id} className="rounded-2xl border border-line bg-surface/70 p-4 lg:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="flex min-w-0 flex-none items-center gap-3 lg:w-72">
                    <div className="flex flex-none flex-col items-center gap-1">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-2 text-xs font-semibold text-text">
                        {initials(reporterName)}
                      </span>
                      <span className="text-[10px] text-muted-2">denunciou</span>
                      <span className="grid h-10 w-10 place-items-center rounded-xl border border-danger/40 bg-danger/10 text-xs font-semibold text-danger">
                        {initials(reportedName ?? "?")}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text">{reporterName}</p>
                      <p className="truncate text-xs text-muted-2">→</p>
                      <p
                        className={`truncate text-sm font-medium ${isOpen ? "text-danger" : "text-muted"}`}
                      >
                        {reportedName ?? "conta removida"}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/spokesperson/mission/db-${missionId}`}
                        className="truncate font-medium text-gold-hi hover:underline"
                      >
                        {missionTitle}
                      </Link>
                      <span className="rounded-md border border-line bg-ink-2 px-2 py-0.5 text-[11px] text-muted">
                        {MISSION_STATUS_LABELS[missionStatus] ?? missionStatus}
                      </span>
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_LABELS[status]?.cls ?? "border-line text-muted"}`}
                      >
                        {STATUS_LABELS[status]?.txt ?? status}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-line break-words text-sm text-text/90">
                      {text}
                    </p>
                    <p className="mt-1 text-xs text-muted-2">{shortDate(createdAt)}</p>
                  </div>

                  {isOpen && (
                    <div className="flex flex-none flex-col gap-2 lg:w-44">
                      {reportedHandle && (
                        <Link
                          href={`/inspector/accounts?q=${encodeURIComponent(reportedHandle)}`}
                          className="btn-ghost text-center text-xs"
                        >
                          Ver conta de {reportedHandle}
                        </Link>
                      )}
                      <button
                        className="btn-gold !py-2 text-xs"
                        onClick={() => void handleAction(d.id, "resolve")}
                        disabled={processingId === d.id}
                      >
                        {processingId === d.id ? "…" : "Marcar resolvida"}
                      </button>
                      <button
                        className="btn-ghost !py-2 text-xs"
                        onClick={() => void handleAction(d.id, "ignore")}
                        disabled={processingId === d.id}
                      >
                        Ignorar
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export { ReportsPanel as PainelDenuncias };
