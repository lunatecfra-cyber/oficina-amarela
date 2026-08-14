"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { iniciais } from "@/lib/candidatos";
import type { Denuncia } from "@/lib/denuncias-db";

const ROTULO_STATUS: Record<Denuncia["status"], { txt: string; cls: string }> = {
  aberta: { txt: "aberta", cls: "border-danger/40 bg-danger/10 text-danger" },
  resolvida: { txt: "resolvida", cls: "border-ok/40 bg-ok/10 text-ok" },
  ignorada: { txt: "ignorada", cls: "border-line text-muted" },
};

const ROTULO_STATUS_MISSAO: Record<string, string> = {
  disponivel: "na fila",
  oferecida: "em oferta",
  reservada: "com editor",
  em_revisao: "em revisão",
  reedicao: "em reedição",
  aprovada: "aprovada",
  finalizada: "finalizada",
};

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Painel de denúncias do inspetor: quem reclamou, de quem, em que missão. */
export function PainelDenuncias({ denuncias }: { denuncias: Denuncia[] }) {
  const router = useRouter();
  const [processando, setProcessando] = useState<number | null>(null);
  const [erro, setErro] = useState("");

  const abertas = denuncias.filter((d) => d.status === "aberta").length;

  async function agir(denunciaId: number, acao: "resolver" | "ignorar") {
    setErro("");
    setProcessando(denunciaId);
    try {
      const resp = await fetch("/api/admin/denuncias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ denunciaId, acao }),
      });
      if (!resp.ok) {
        const dados = await resp.json().catch(() => null);
        setErro(dados?.erro ?? "Não deu pra concluir.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Sem conexão. Tenta de novo.");
    } finally {
      setProcessando(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
            Denúncias
          </h1>
          <p className="mt-1 text-sm text-muted">
            Reclamações que chegaram de dentro das missões.
          </p>
        </div>
        <p className="text-sm text-muted">{abertas} aberta{abertas === 1 ? "" : "s"}</p>
      </div>

      {erro && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {erro}
        </p>
      )}

      {denuncias.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line-soft bg-surface/40 p-10 text-center text-sm text-muted">
          Nenhuma denúncia até agora. Boa notícia.
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {denuncias.map((d) => (
            <li key={d.id} className="rounded-2xl border border-line bg-surface/70 p-4 lg:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                {/* quem → quem */}
                <div className="flex min-w-0 flex-none items-center gap-3 lg:w-72">
                  <div className="flex flex-none flex-col items-center gap-1">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-2 text-xs font-semibold text-text">
                      {iniciais(d.denuncianteNome)}
                    </span>
                    <span className="text-[10px] text-muted-2">denunciou</span>
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-danger/40 bg-danger/10 text-xs font-semibold text-danger">
                      {iniciais(d.denunciadoNome ?? "?")}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">{d.denuncianteNome}</p>
                    <p className="truncate text-xs text-muted-2">→</p>
                    <p className={`truncate text-sm font-medium ${d.status === "aberta" ? "text-danger" : "text-muted"}`}>
                      {d.denunciadoNome ?? "conta removida"}
                    </p>
                  </div>
                </div>

                {/* missão + texto */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/porta-voz/missao/db-${d.pautaId}`}
                      className="truncate font-medium text-gold-hi hover:underline"
                    >
                      {d.pautaTitulo}
                    </Link>
                    <span className="rounded-md border border-line bg-ink-2 px-2 py-0.5 text-[11px] text-muted">
                      {ROTULO_STATUS_MISSAO[d.pautaStatus] ?? d.pautaStatus}
                    </span>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${ROTULO_STATUS[d.status].cls}`}
                    >
                      {ROTULO_STATUS[d.status].txt}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-line break-words text-sm text-text/90">{d.texto}</p>
                  <p className="mt-1 text-xs text-muted-2">{dataCurta(d.criadaEm)}</p>
                </div>

                {/* ações — só enquanto aberta */}
                {d.status === "aberta" && (
                  <div className="flex flex-none flex-col gap-2 lg:w-44">
                    {d.denunciadoApelido && (
                      <Link
                        href={`/inspetor/contas?q=${encodeURIComponent(d.denunciadoApelido)}`}
                        className="btn-ghost text-center text-xs"
                      >
                        Ver conta de {d.denunciadoApelido}
                      </Link>
                    )}
                    <button
                      className="btn-gold !py-2 text-xs"
                      onClick={() => void agir(d.id, "resolver")}
                      disabled={processando === d.id}
                    >
                      {processando === d.id ? "…" : "Marcar resolvida"}
                    </button>
                    <button
                      className="btn-ghost !py-2 text-xs"
                      onClick={() => void agir(d.id, "ignorar")}
                      disabled={processando === d.id}
                    >
                      Ignorar
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
