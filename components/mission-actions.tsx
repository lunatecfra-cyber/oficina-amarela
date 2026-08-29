"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MissionActions({
  id,
  inReview = false,
  emRevisao = false,
}: {
  id: string;
  inReview?: boolean;
  emRevisao?: boolean;
}) {
  const router = useRouter();
  const effectiveInReview = inReview || emRevisao;

  const [processingAction, setProcessingAction] = useState<"accept" | "revision" | "approve" | null>(null);
  const [isOpeningRevision, setIsOpeningRevision] = useState(false);
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [notice, setNotice] = useState("");

  async function send(action: "accept" | "revision" | "approve") {
    if (action === "revision" && !notes.trim()) {
      setNotice("Escreva o que precisa mudar.");
      return;
    }
    setNotice("");
    setProcessingAction(action);

    const body =
      action === "revision"
        ? { action: "revision", notes: notes.trim(), acao: "ajuste", notas: notes.trim() }
        : effectiveInReview
          ? { action: "approve", rating, acao: "aprovar", nota: rating }
          : { action: "accept", acao: "aceitar" };

    const resp = await fetch(`/api/missions/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => null);
      setNotice(data?.error ?? data?.erro ?? "Não deu pra concluir. Tenta de novo.");
      setProcessingAction(null);
      return;
    }

    setProcessingAction(null);
    setIsOpeningRevision(false);
    setNotes("");
    router.refresh();
  }

  return (
    <section className="mb-8 rounded-2xl border border-gold-lo/50 bg-gradient-to-b from-gold/[0.07] to-transparent p-5 lg:p-6">
      <p className="text-xs uppercase tracking-[0.14em] text-gold-hi">
        Sua vez de conferir
      </p>
      <p className="mt-2 text-sm text-muted">
        {effectiveInReview
          ? "O editor entregou. Assista e diga se pode ir pro ar — ou peça um ajuste antes."
          : "O controle de qualidade já aprovou. Assista ao vídeo e diga se pode ir pro ar — ou peça um ajuste antes."}
      </p>

      {effectiveInReview && !isOpeningRevision && (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-[0.12em] text-muted">
            Que nota o editor merece? <span className="text-muted-2">(opcional)</span>
          </p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} de 5`}
                aria-pressed={rating === n}
                onClick={() => setRating(rating === n ? undefined : n)}
                className={`text-2xl leading-none transition-colors ${
                  rating !== undefined && n <= rating
                    ? "text-gold"
                    : "text-line hover:text-gold-lo"
                }`}
              >
                ★
              </button>
            ))}
            {rating !== undefined && (
              <button
                type="button"
                className="ml-2 text-xs text-muted-2 underline hover:text-muted"
                onClick={() => setRating(undefined)}
              >
                limpar
              </button>
            )}
          </div>
        </div>
      )}

      {isOpeningRevision ? (
        <div className="mt-5">
          <label
            htmlFor="ajuste"
            className="mb-2 block text-xs uppercase tracking-[0.12em] text-muted"
          >
            O que precisa mudar?
          </label>
          <textarea
            id="ajuste"
            className="field-input !pl-4 min-h-28 py-3"
            placeholder="ex.: cortar os 3 primeiros segundos e aumentar a legenda"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setNotice("");
            }}
            autoFocus
          />

          {notice && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {notice}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              className="btn-gold sm:flex-1"
              onClick={() => send("revision")}
              disabled={processingAction !== null}
            >
              {processingAction === "revision" ? "Enviando…" : "Enviar pro editor"}
            </button>
            <button
              className="btn-ghost sm:w-40"
              onClick={() => {
                setIsOpeningRevision(false);
                setNotice("");
              }}
              disabled={processingAction !== null}
            >
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <>
          {notice && (
            <p role="alert" className="mt-4 text-sm text-danger">
              {notice}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row" data-guia="aprovar-missao">
            <button
              className="btn-gold sm:flex-1"
              onClick={() => send(effectiveInReview ? "approve" : "accept")}
              disabled={processingAction !== null}
            >
              {processingAction === "accept"
                ? "Fechando…"
                : effectiveInReview
                  ? "✅ Aprovar e fechar"
                  : "✅ Aceitar e postar"}
            </button>
            <button
              className="btn-ghost sm:w-48"
              onClick={() => setIsOpeningRevision(true)}
              disabled={processingAction !== null}
            >
              💬 Pedir ajuste
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export { MissionActions as AcoesMissao };
