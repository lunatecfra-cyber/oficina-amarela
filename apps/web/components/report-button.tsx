"use client";

import { LIMITS } from "@oficina/domain/limits";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReportButton({ missionId, pautaId }: { missionId?: string; pautaId?: string }) {
  const effectiveId = missionId ?? pautaId ?? "";
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [isSent, setIsSent] = useState(false);

  async function sendReport() {
    const t = text.trim();
    if (!t || isSending) return;
    setIsSending(true);
    setError("");
    try {
      const resp = await fetch(`/api/missions/${effectiveId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "report", text: t, acao: "denunciar", texto: t }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        setError(data?.error ?? data?.erro ?? "Não deu pra denunciar.");
        return;
      }
      setIsSent(true);
      setIsOpen(false);
      setText("");
      router.refresh();
    } catch {
      setError("Sem conexão. Tenta de novo.");
    } finally {
      setIsSending(false);
    }
  }

  if (isSent) {
    return (
      <p className="rounded-xl border border-gold-lo/50 bg-gold/[0.07] px-4 py-3 text-sm text-text">
        Denúncia enviada. O controle de qualidade vai olhar.
      </p>
    );
  }

  return (
    <div>
      {!isOpen ? (
        <button
          className="text-xs uppercase tracking-[0.12em] text-muted-2 transition-colors hover:text-danger"
          onClick={() => setIsOpen(true)}
        >
          🚩 Denunciar esta missão
        </button>
      ) : (
        <div className="rounded-xl border border-danger/30 bg-danger/[0.04] p-3">
          <label
            htmlFor={`denuncia-${effectiveId}`}
            className="mb-2 block text-xs uppercase tracking-[0.12em] text-danger/90"
          >
            O que aconteceu?
          </label>
          <textarea
            id={`denuncia-${effectiveId}`}
            className="field-input !pl-4 min-h-24 resize-y"
            placeholder="Descreva o problema — o controle de qualidade vai ler isto."
            value={text}
            maxLength={LIMITS.report}
            onChange={(e) => {
              setText(e.target.value);
              setError("");
            }}
          />
          {error && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              className="btn-ghost flex-1 !border-danger/40 !text-danger hover:!bg-danger/10"
              onClick={() => void sendReport()}
              disabled={isSending || !text.trim()}
            >
              {isSending ? "Enviando…" : "Enviar denúncia"}
            </button>
            <button
              className="btn-ghost w-28"
              onClick={() => {
                setIsOpen(false);
                setText("");
                setError("");
              }}
              disabled={isSending}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { ReportButton as DenunciaBotao };
