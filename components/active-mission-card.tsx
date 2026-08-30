"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FORMAT_LABEL, type Mission, type Pauta } from "@/lib/missions";
import { looksLikeDriveLink, looksLikeYoutubeLink } from "@/lib/validators";
import { MissionChat } from "@/components/mission-chat";
import { TutorialButton, TutorialDrive } from "@/components/tutorial-drive";
import { UploadDropzone } from "@/components/upload-dropzone";
import type { ChatMessage } from "@/lib/chat-db";
import { ReportButton } from "@/components/report-button";

function Chip({ k, v }: { k: string; v: string }) {
  return (
    <span className="rounded-md border border-line-soft bg-surface px-2 py-0.5 text-[11px] text-muted">
      <span className="text-muted-2">{k}:</span> {v}
    </span>
  );
}

function GoldDivider() {
  return (
    <div
      aria-hidden="true"
      className="mb-4 h-px rounded-full"
      style={{
        background:
          "linear-gradient(90deg, transparent 0%, rgba(244,206,31,0.7) 30%, rgba(244,206,31,0.9) 50%, rgba(244,206,31,0.7) 70%, transparent 100%)",
      }}
    />
  );
}

function shortDate(ymd: string) {
  return new Date(ymd).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export function ActiveMissionCard({
  mission,
  missao,
  messages = [],
  mensagens = [],
}: {
  mission?: Mission | null;
  missao?: Mission | null;
  messages?: ChatMessage[];
  mensagens?: ChatMessage[];
}) {
  const router = useRouter();
  const currentMission = mission ?? missao ?? null;
  const currentMessages = messages.length > 0 ? messages : mensagens;

  const [deliveryLink, setDeliveryLink] = useState("");
  const [notice, setNotice] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  if (!currentMission) return null;

  const title = currentMission.title ?? currentMission.titulo;
  const spokesperson = currentMission.spokesperson ?? currentMission.portaVoz;
  const format = currentMission.format ?? currentMission.formato ?? "short";
  const status = currentMission.status;
  const rawVideoUrl = currentMission.rawVideoUrl ?? currentMission.videoBrutoUrl;
  const driveLink = currentMission.driveLink;
  const youtubeLink = currentMission.youtubeLink;
  const deliveredVideoUrl = currentMission.deliveryVideoUrl ?? currentMission.videoEntregaUrl ?? currentMission.deliveryLink ?? currentMission.entregaLink;
  const inspectorNotes = currentMission.inspectorNotes ?? currentMission.notasInspetor;
  const revisionBy = currentMission.revisionRequestedBy ?? currentMission.reedicaoPedidaPor;
  const watermark = currentMission.watermark ?? currentMission.marcaDagua;
  const campaignTaxId = currentMission.campaignTaxId ?? currentMission.cnpjCampanha;
  const candidateNumber = currentMission.candidateNumber ?? currentMission.numeroEleitoral;
  const voterId = currentMission.voterId ?? currentMission.tituloEleitor;
  const desiredDeadline = currentMission.desiredDeadline ?? currentMission.prazoDesejado;
  const extras = currentMission.extras;
  const motivation = currentMission.motivation ?? currentMission.motivo;

  async function executeAction(action: "deliver" | "cancel", link?: string) {
    setNotice("");
    setIsProcessing(true);
    const resp = await fetch(`/api/missions/${currentMission!.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(link ? { action, link, acao: action } : { action, acao: action }),
    });
    setIsProcessing(false);

    if (!resp.ok) {
      const data = await resp.json().catch(() => null);
      setNotice(data?.error ?? data?.erro ?? "Não deu pra concluir. Tenta de novo.");
      return;
    }
    setDeliveryLink("");
    router.refresh();
  }

  function handleDeliver() {
    if (!deliveryLink.trim()) {
      setNotice("Cole o link do vídeo pronto antes de confirmar.");
      return;
    }
    executeAction("deliver", deliveryLink.trim());
  }

  const hasBrief =
    currentMission.brief?.tone ||
    currentMission.brief?.color ||
    currentMission.brief?.font ||
    currentMission.brief?.refs ||
    currentMission.brief?.tom ||
    currentMission.brief?.cor ||
    currentMission.brief?.fonte ||
    extras ||
    motivation;

  const isAwaitingReview = status === "in_review" || status === "em_revisao";
  const isRevision = status === "revision_requested" || status === "reedicao";

  return (
    <section className="mb-10 rounded-2xl border border-gold-lo/50 bg-gradient-to-b from-gold/[0.07] to-transparent p-6 lg:p-8">
      <GoldDivider />
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-gold-lo/60 bg-gold/10 px-2.5 py-0.5 text-[11px] font-medium text-gold-hi">
          Sua missão
        </span>
        <span className="text-xs uppercase tracking-[0.15em] text-gold-hi">
          {isAwaitingReview
            ? "Entregue · em revisão"
            : isRevision
              ? "Ajuste pedido"
              : "Missão aceita"}
        </span>
      </div>

      <h2 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {spokesperson} · {FORMAT_LABEL[format]}
        {desiredDeadline && <> · pra {shortDate(desiredDeadline)}</>}
      </p>

      {isRevision && inspectorNotes && (
        <div className="mt-4 rounded-2xl border border-danger/40 bg-danger/[0.06] p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-danger">
            {revisionBy === "spokesperson" || revisionBy === "porta_voz"
              ? "O porta-voz pediu um ajuste"
              : "O controle de qualidade pediu um ajuste"}
          </p>
          <p className="mt-2 whitespace-pre-line text-sm text-text">
            {inspectorNotes}
          </p>
        </div>
      )}

      {(watermark || campaignTaxId || candidateNumber || voterId) && (
        <div className="mt-4 rounded-2xl border border-gold/40 bg-gold/[0.06] p-4 flex gap-3">
          <div className="mt-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-gold">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gold">
              Inclusão Obrigatória (TSE)
            </p>
            <p className="mt-1 text-sm text-silver-lo">
              As seguintes informações devem aparecer de forma legível no vídeo final:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-text">
              {watermark && <li><span className="text-muted-2">Marca d&apos;água:</span> {watermark}</li>}
              {campaignTaxId && <li><span className="text-muted-2">CNPJ:</span> {campaignTaxId}</li>}
              {candidateNumber && <li><span className="text-muted-2">Número eleitoral:</span> {candidateNumber}</li>}
              {voterId && <li><span className="text-muted-2">Título de Eleitor:</span> {voterId}</li>}
            </ul>
          </div>
        </div>
      )}

      {(rawVideoUrl || (driveLink && looksLikeDriveLink(driveLink)) || (youtubeLink && looksLikeYoutubeLink(youtubeLink))) && (
        <div className="mt-5 rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/[0.08] to-gold/[0.03] p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-gold">
            Acesso ao bruto
          </p>
          <p
            className="mt-3 flex flex-wrap items-center gap-2"
            data-guia="abrir-bruto"
          >
            {rawVideoUrl && (
              <a
                href={rawVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-base font-semibold text-surface transition-colors hover:bg-gold-hi"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L9 11.586V4a1 1 0 011-1z" clipRule="evenodd" />
                  <path d="M4 16a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" />
                </svg>
                Baixar Vídeo
              </a>
            )}
            {driveLink && looksLikeDriveLink(driveLink) && (
              <a
                href={driveLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-5 py-2.5 text-base font-semibold text-gold-hi transition-colors hover:bg-gold/20"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden="true">
                  <path d="M5 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Abrir pasta no Drive
              </a>
            )}
            {youtubeLink && looksLikeYoutubeLink(youtubeLink) && (
              <a
                href={youtubeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-5 py-2.5 text-base font-semibold text-gold-hi transition-colors hover:bg-gold/20"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden="true">
                  <path d="M5 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Abrir no YouTube
              </a>
            )}
          </p>
          <p className="mt-3 text-xs text-muted-2">
            Se o Drive pedir permissão, peça a liberação a quem criou a missão —
            hoje esse acesso ainda é liberado à mão.
          </p>
        </div>
      )}

      {hasBrief && (
        <div className="mt-4 rounded-2xl border border-line bg-surface/60 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-muted">
            O que foi pedido
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {(currentMission.brief?.tone ?? currentMission.brief?.tom) && (
              <Chip k="tom" v={(currentMission.brief.tone ?? currentMission.brief.tom)!} />
            )}
            {(currentMission.brief?.color ?? currentMission.brief?.cor) && (
              <Chip k="cor" v={(currentMission.brief.color ?? currentMission.brief.cor)!} />
            )}
            {(currentMission.brief?.font ?? currentMission.brief?.fonte) && (
              <Chip k="fonte" v={(currentMission.brief.font ?? currentMission.brief.fonte)!} />
            )}
            {currentMission.brief?.refs && <Chip k="ref" v={currentMission.brief.refs} />}
          </div>
          {(extras || motivation) && (
            <div className="mt-3 flex flex-col gap-2 text-xs">
              {extras && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-2">
                    Cortes pedidos
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-muted">
                    {extras}
                  </p>
                </div>
              )}
              {motivation && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-2">
                    Contexto
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-muted">
                    {motivation}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isAwaitingReview ? (
        <>
          <div className="mt-5 rounded-2xl border border-ok/40 bg-ok/[0.06] p-4">
            <p className="flex flex-wrap items-center gap-2 text-sm text-text">
              <span className="text-ok">✓</span> Entregue. Agora é com o controle
              de qualidade — assim que aprovarem, a próxima missão chega pra você.
              {deliveredVideoUrl && (
                <a
                  href={deliveredVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-gold-hi hover:underline"
                >
                  Ver o que você entregou
                </a>
              )}
            </p>
          </div>

          <p className="mt-3 text-xs text-muted-2">
            Precisa trocar o vídeo? Fale com quem pediu a missão — depois de
            aprovada, ela não volta pra edição sozinha.
          </p>
        </>
      ) : (
        <>
          <div className="mt-5" data-guia="campo-entrega">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-gold">
              Entregar Vídeo Pronto
            </h3>

            <UploadDropzone
              label="Fazer upload do vídeo editado"
              onUploadSuccess={(url) => {
                setDeliveryLink(url);
                setNotice("");
              }}
            />

            <div className="mt-4 flex items-center gap-4">
              <div className="h-px flex-1 bg-line" />
              <span className="text-[10px] text-muted font-medium uppercase tracking-widest">OU COLE UM LINK</span>
              <div className="h-px flex-1 bg-line" />
            </div>

            <div className="mt-4 flex gap-2">
              <input
                id="entrega"
                className="field-input !pl-4"
                placeholder="cole aqui o link do Drive (opcional se fez upload)"
                value={deliveryLink}
                onChange={(e) => {
                  setDeliveryLink(e.target.value);
                  setNotice("");
                }}
              />
              <TutorialButton onClick={() => setIsTutorialOpen(true)} />
            </div>
          </div>

          <TutorialDrive
            type="entrega"
            isOpen={isTutorialOpen}
            onClose={() => setIsTutorialOpen(false)}
          />

          {notice && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {notice}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button className="btn-gold sm:flex-1" onClick={handleDeliver} disabled={isProcessing}>
              {isProcessing ? "Enviando…" : "Confirmar entrega"}
            </button>
            <button
              className="btn-ghost sm:w-52"
              onClick={() => executeAction("cancel")}
              disabled={isProcessing}
            >
              {isProcessing ? "…" : "Devolver missão"}
            </button>
          </div>

          <p className="mt-3 text-xs text-muted-2">
            Sem prazo — a missão é sua até entregar. Devolver libera pra outro editor.
          </p>
        </>
      )}

      <div className="mt-6">
        <MissionChat missionId={currentMission.id} messages={currentMessages} />
      </div>
      <div className="mt-4">
        <ReportButton missionId={currentMission.id} />
      </div>
    </section>
  );
}

export { ActiveMissionCard as MissaoEmMaos };
