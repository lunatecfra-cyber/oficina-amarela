"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LegalNotice } from "@/components/legal-notice";
import { TutorialButton, TutorialDrive } from "@/components/tutorial-drive";
import { UploadDropzone } from "@/components/upload-dropzone";
import type { Format, Formato } from "@/lib/missions";
import { looksLikeDriveLink, looksLikeLink, looksLikeYoutubeLink } from "@/lib/validators";

type FormData = {
  title: string;
  driveLink: string;
  youtubeLink: string;
  extras: string;
  tone: string;
  color: string;
  font: string;
  refs: string;
  reason: string;
  format: Format | Formato | "";
  deadline: string;
  rawVideoUrl: string;
  watermark: string;
  campaignTaxId: string;
  voterId: string;
};

const EMPTY_FORM: FormData = {
  title: "",
  driveLink: "",
  youtubeLink: "",
  extras: "",
  tone: "",
  color: "",
  font: "",
  refs: "",
  reason: "",
  format: "short",
  deadline: "",
  rawVideoUrl: "",
  watermark: "",
  campaignTaxId: "",
  voterId: "",
};

const STEPS = ["O vídeo bruto", "Cortes específicos", "O estilo", "Contexto", "Formato"];

interface NewMissionFormProps {
  defaultWatermark?: string;
  defaultCampaignTaxId?: string;
  defaultVoterId?: string;
  marcaDaguaPadrao?: string;
  cnpjCampanhaPadrao?: string;
  tituloEleitorPadrao?: string;
}

export function NewMissionForm({
  defaultWatermark,
  defaultCampaignTaxId,
  defaultVoterId,
  marcaDaguaPadrao,
  cnpjCampanhaPadrao,
  tituloEleitorPadrao,
}: NewMissionFormProps = {}) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  useEffect(() => {
    if (!isTutorialOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsTutorialOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isTutorialOpen]);

  useEffect(() => {
    const wm = defaultWatermark || marcaDaguaPadrao || "";
    const tax = defaultCampaignTaxId || cnpjCampanhaPadrao || "";
    const voter = defaultVoterId || tituloEleitorPadrao || "";

    setData((d) => ({
      ...d,
      watermark: d.watermark || wm,
      campaignTaxId: d.campaignTaxId || tax,
      voterId: d.voterId || voter,
    }));
  }, [
    defaultWatermark,
    defaultCampaignTaxId,
    defaultVoterId,
    marcaDaguaPadrao,
    cnpjCampanhaPadrao,
    tituloEleitorPadrao,
  ]);

  const setField = <K extends keyof FormData>(k: K, v: FormData[K]) => {
    setData((d) => ({ ...d, [k]: v }));
    setError("");
  };

  function validate(p: number): string {
    if (p === 0) {
      if (!data.title.trim()) return "Dê um título pra missão.";
      const hasDrive = data.driveLink.trim().length > 0;
      const hasYoutube = data.youtubeLink.trim().length > 0;
      const hasUpload = data.rawVideoUrl.trim().length > 0;
      if (!hasDrive && !hasYoutube && !hasUpload)
        return "Faça o upload do vídeo ou cole um link do Drive/YouTube.";
      if (hasDrive && !looksLikeLink(data.driveLink))
        return "O link do Drive não parece um link válido. Confere?";
      if (hasDrive && !looksLikeDriveLink(data.driveLink))
        return "Isso não parece um link do Google Drive. Cole o link de compartilhamento (drive.google.com).";
      if (hasYoutube && !looksLikeYoutubeLink(data.youtubeLink))
        return "Isso não parece um link do YouTube. Cole o link (youtube.com ou youtu.be).";
    }
    if (p === 4 && !data.format) return "Escolha o formato.";
    return "";
  }

  function handleNext() {
    const e = validate(step);
    if (e) return setError(e);
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleSubmit();
  }

  function handlePrev() {
    setError("");
    if (step > 0) setStep(step - 1);
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    const resp = await fetch("/api/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.title,
        format: data.format,
        driveLink: data.driveLink,
        youtubeLink: data.youtubeLink,
        tone: data.tone,
        color: data.color,
        font: data.font,
        refs: data.refs,
        extras: data.extras,
        reason: data.reason,
        deadline: data.deadline,
        rawVideoUrl: data.rawVideoUrl,
        watermark: data.watermark,
        campaignTaxId: data.campaignTaxId,
        voterId: data.voterId,
        // compatibility aliases
        titulo: data.title,
        formato: data.format,
        tom: data.tone,
        cor: data.color,
        fonte: data.font,
        motivo: data.reason,
        prazo: data.deadline,
        videoBrutoUrl: data.rawVideoUrl,
        marcaDagua: data.watermark,
        cnpjCampanha: data.campaignTaxId,
        tituloEleitor: data.voterId,
      }),
    });
    const body = await resp.json().catch(() => null);
    setIsSubmitting(false);

    if (!resp.ok) {
      setError(body?.error ?? body?.erro ?? "Não deu pra criar a missão. Tenta de novo.");
      return;
    }
    setIsSubmitted(true);
  }

  if (isSubmitted) {
    return (
      <div className="mx-auto w-full max-w-lg py-16 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-ok/40 bg-ok/10">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="h-8 w-8 text-ok"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-3xl font-semibold text-text">
          Missão enviada!
        </h1>
        <p className="mt-3 text-muted">
          Ela já está na fila dos editores. Você acompanha o status na sua área e recebe o vídeo
          pronto por aqui.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/porta-voz" className="btn-gold sm:w-56">
            Ver minhas missões
          </Link>
          <button
            className="btn-ghost sm:w-56"
            onClick={() => {
              setData(EMPTY_FORM);
              setStep(0);
              setIsSubmitted(false);
            }}
          >
            Criar outra missão
          </button>
        </div>
      </div>
    );
  }

  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="mx-auto w-full max-w-xl py-8 lg:py-12">
      <div className="mb-8" data-guia="passos-briefing">
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="uppercase tracking-[0.14em] text-gold">
            Passo {step + 1} de {STEPS.length}
          </span>
          <span>{STEPS[step]}</span>
        </div>
        <div className="mt-3 flex gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-gold" : "bg-line"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="min-h-[280px]">
        {step === 0 && (
          <StepContainer title="O vídeo bruto" subtitle="O material que o editor vai trabalhar.">
            <LegalNotice />

            <div className="grid gap-4 sm:grid-cols-2">
              <FieldWrapper label="Marca d'água">
                <input
                  className="field-input !pl-4"
                  placeholder="ex.: Candidato Oficial - #12345"
                  value={data.watermark}
                  onChange={(e) => setField("watermark", e.target.value)}
                />
              </FieldWrapper>
              <FieldWrapper label="CNPJ da campanha">
                <input
                  className="field-input !pl-4"
                  placeholder="00.000.000/0000-00"
                  value={data.campaignTaxId}
                  onChange={(e) => setField("campaignTaxId", e.target.value)}
                />
              </FieldWrapper>
            </div>

            <FieldWrapper label="Título de Eleitor (TSE)">
              <input
                className="field-input !pl-4"
                placeholder="0000 0000 0000"
                value={data.voterId}
                onChange={(e) => setField("voterId", e.target.value)}
              />
            </FieldWrapper>

            <FieldWrapper label="Título da missão">
              <input
                className="field-input !pl-4"
                placeholder="ex.: Corte sobre segurança no bairro"
                value={data.title}
                onChange={(e) => setField("title", e.target.value)}
                autoFocus
              />
            </FieldWrapper>

            <div className="mt-4">
              <UploadDropzone onUploadSuccess={(url) => setField("rawVideoUrl", url)} />
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="h-px flex-1 bg-line" />
              <span className="text-xs text-muted font-medium">OU COLE LINKS MANUALMENTE</span>
              <div className="h-px flex-1 bg-line" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mt-2">
              <FieldWrapper label="Link do Drive (opcional)" guide="campo-drive">
                <input
                  className="field-input !pl-4"
                  placeholder="cole o link de compartilhamento, se tiver"
                  value={data.driveLink}
                  onChange={(e) => setField("driveLink", e.target.value)}
                  inputMode="url"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                <TutorialButton onClick={() => setIsTutorialOpen(true)} />
              </FieldWrapper>
              <FieldWrapper label="Link do YouTube (opcional)">
                <input
                  className="field-input !pl-4"
                  placeholder="cole o link do vídeo no YouTube, se tiver"
                  value={data.youtubeLink}
                  onChange={(e) => setField("youtubeLink", e.target.value)}
                  inputMode="url"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </FieldWrapper>
            </div>
          </StepContainer>
        )}

        {step === 1 && (
          <StepContainer
            title="Cortes específicos"
            subtitle="Tem algum trecho, corte ou material extra que precisa entrar? (opcional)"
          >
            <FieldWrapper label="Links ou trechos (um por linha)">
              <textarea
                className="field-input !pl-4 min-h-32 resize-y"
                placeholder={"ex.: usar do minuto 3:20 ao 3:45\nlink de outro bruto pra encaixar"}
                value={data.extras}
                onChange={(e) => setField("extras", e.target.value)}
              />
            </FieldWrapper>
          </StepContainer>
        )}

        {step === 2 && (
          <StepContainer
            title="O estilo"
            subtitle="Quanto mais claro, mais o editor acerta de primeira. (opcional)"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldWrapper label="Tom">
                <input
                  className="field-input !pl-4"
                  placeholder="ex.: direto e firme"
                  value={data.tone}
                  onChange={(e) => setField("tone", e.target.value)}
                />
              </FieldWrapper>
              <FieldWrapper label="Cor">
                <input
                  className="field-input !pl-4"
                  placeholder="ex.: quente / fria"
                  value={data.color}
                  onChange={(e) => setField("color", e.target.value)}
                />
              </FieldWrapper>
              <FieldWrapper label="Fonte / legenda">
                <input
                  className="field-input !pl-4"
                  placeholder="ex.: bold condensada"
                  value={data.font}
                  onChange={(e) => setField("font", e.target.value)}
                />
              </FieldWrapper>
              <FieldWrapper label="Referências">
                <input
                  className="field-input !pl-4"
                  placeholder="ex.: estilo podcast"
                  value={data.refs}
                  onChange={(e) => setField("refs", e.target.value)}
                />
              </FieldWrapper>
            </div>
          </StepContainer>
        )}

        {step === 3 && (
          <StepContainer
            title="Contexto"
            subtitle="Por que esse vídeo importa? Ajuda o editor a entender a intenção. (opcional)"
          >
            <FieldWrapper label="Motivo / motivação">
              <textarea
                className="field-input !pl-4 min-h-32 resize-y"
                placeholder="ex.: resposta a um tema que bombou essa semana"
                value={data.reason}
                onChange={(e) => setField("reason", e.target.value)}
              />
            </FieldWrapper>
          </StepContainer>
        )}

        {step === 4 && (
          <StepContainer title="Formato" subtitle="Como você precisa do vídeo.">
            <FieldWrapper label="Formato">
              <div className="rounded-xl border border-gold bg-gold/10 p-4">
                <span className="block font-medium text-text">Short 9:16</span>
                <span className="text-xs text-muted">vertical</span>
              </div>
            </FieldWrapper>
          </StepContainer>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        {step > 0 ? (
          <button className="btn-ghost w-32" onClick={handlePrev}>
            Voltar
          </button>
        ) : (
          <Link href="/porta-voz" className="btn-ghost w-32 text-center">
            Cancelar
          </Link>
        )}
        <button className="btn-gold flex-1" onClick={handleNext} disabled={isSubmitting}>
          {isSubmitting ? "Enviando…" : isLastStep ? "Enviar missão" : "Continuar"}
        </button>
      </div>

      <TutorialDrive
        type="drive"
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
      />
    </div>
  );
}

function StepContainer({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text">
        {title}
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted">{subtitle}</p>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

function FieldWrapper({
  label,
  guide,
  children,
}: {
  label: string;
  guide?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block" data-guia={guide} data-guide={guide}>
      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

export { NewMissionForm as NovaPautaForm };
