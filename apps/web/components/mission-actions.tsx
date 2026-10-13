"use client";

import { Check, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function MissionActions({
  id,
  inReview = false,
  emRevisao = false,
  deliveryVersion = 0,
}: {
  id: string;
  inReview?: boolean;
  emRevisao?: boolean;
  deliveryVersion?: number;
}) {
  const router = useRouter();
  const effectiveInReview = inReview || emRevisao;

  const [processingAction, setProcessingAction] = useState<
    "accept" | "revision" | "approve" | null
  >(null);
  const [isOpeningRevision, setIsOpeningRevision] = useState(false);
  const [notes, setNotes] = useState("");
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
        : { action: "accept", acao: "aceitar" };

    const resp = await fetch(`/api/missions/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, expectedDeliveryVersion: deliveryVersion }),
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
      <p className="text-xs uppercase tracking-[0.14em] text-gold-hi">Sua vez de conferir</p>
      <p className="mt-2 text-sm text-muted">
        {effectiveInReview
          ? "O editor entregou. A aprovação final aguarda a fiscalização independente. Você já pode assistir e pedir ajustes."
          : "O controle de qualidade já aprovou. Assista ao vídeo e diga se pode ir pro ar, ou peça um ajuste antes."}
      </p>

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
              className="btn-gold gap-2 sm:flex-1"
              onClick={() => send("accept")}
              disabled={processingAction !== null || effectiveInReview}
            >
              {processingAction === "accept" ? (
                "Fechando…"
              ) : effectiveInReview ? (
                "Aguardando fiscalização"
              ) : (
                <>
                  <Check className="h-4 w-4 flex-none" aria-hidden="true" />
                  Aceitar e postar
                </>
              )}
            </button>
            <button
              className="btn-ghost gap-2 sm:w-48"
              onClick={() => setIsOpeningRevision(true)}
              disabled={processingAction !== null}
            >
              <MessageCircle className="h-4 w-4 flex-none" aria-hidden="true" />
              Pedir ajuste
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export { MissionActions as AcoesMissao };
