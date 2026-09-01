"use client";

import type { Format, Formato } from "@oficina/domain/missions";
import { isDriveUrl, isLikelyUrl, isYouTubeUrl } from "@oficina/domain/validators";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LegalNotice } from "@/components/legal-notice";
import { TutorialButton, TutorialDrive } from "@/components/tutorial-drive";
import { UploadDropzone } from "@/components/upload-dropzone";

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
  candidateNumber: string;
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
  candidateNumber: "",
  voterId: "",
};

/**
 * As cinco etapas, na ordem em que a pessoa pensa: primeiro o material, depois
 * o que ela quer que aconteça com ele, depois o gosto, depois as obrigações, e
 * por último como o vídeo precisa sair.
 */
const STEPS = [
  "O vídeo bruto",
  "Objetivo da edição",
  "Referências",
  "Orientações",
  "Formato",
] as const;

/** Onde o rascunho fica guardado — só neste navegador, nada vai pro servidor. */
const DRAFT_KEY = "oficina:rascunho-missao";

interface NewMissionFormProps {
  defaultWatermark?: string;
  defaultCampaignTaxId?: string;
  defaultCandidateNumber?: string;
  defaultVoterId?: string;
  marcaDaguaPadrao?: string;
  cnpjCampanhaPadrao?: string;
  tituloEleitorPadrao?: string;
}

export function NewMissionForm({
  defaultWatermark,
  defaultCampaignTaxId,
  defaultCandidateNumber,
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
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // só depois que o rascunho antigo foi lido é que passamos a gravar — senão o
  // primeiro render gravaria o formulário vazio por cima do que estava salvo
  const readyToSave = useRef(false);

  // recupera o rascunho no navegador (nunca no primeiro useState: o servidor
  // não tem localStorage e o React acusaria diferença de hidratação)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { data?: Partial<FormData>; step?: number };
        if (saved.data) {
          setData((d) => ({ ...d, ...saved.data }));
          setStep(Math.min(Math.max(saved.step ?? 0, 0), STEPS.length - 1));
          setDraftRestored(true);
        }
      }
    } catch {
      // rascunho corrompido ou armazenamento bloqueado: começa do zero
    }
    readyToSave.current = true;
  }, []);

  // grava a cada mudança, com uma pausa pra não escrever a cada tecla
  useEffect(() => {
    if (!readyToSave.current || isSubmitted) return;
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ data, step }));
        setDraftSavedAt(new Date());
      } catch {
        // sem espaço ou modo privado: seguir sem rascunho é melhor que travar
      }
    }, 600);
    return () => window.clearTimeout(id);
  }, [data, step, isSubmitted]);

  function clearDraft() {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // nada a fazer
    }
    setDraftSavedAt(null);
    setDraftRestored(false);
  }

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
      candidateNumber: d.candidateNumber || defaultCandidateNumber || "",
      voterId: d.voterId || voter,
    }));
  }, [
    defaultWatermark,
    defaultCampaignTaxId,
    defaultCandidateNumber,
    defaultVoterId,
    marcaDaguaPadrao,
    cnpjCampanhaPadrao,
    tituloEleitorPadrao,
  ]);

  const setField = <K extends keyof FormData>(k: K, v: FormData[K]) => {
    setData((d) => ({ ...d, [k]: v }));
    setError("");
    // o aviso de "recuperado" só faz sentido até a pessoa mexer em alguma coisa;
    // daí em diante o que interessa é saber que o novo texto está salvo
    setDraftRestored(false);
  };

  function validate(p: number): string {
    if (p === 0) {
      if (!data.title.trim()) return "Dê um título pra missão.";
      const hasDrive = data.driveLink.trim().length > 0;
      const hasYoutube = data.youtubeLink.trim().length > 0;
      const hasUpload = data.rawVideoUrl.trim().length > 0;
      if (!hasDrive && !hasYoutube && !hasUpload)
        return "Faça o upload do vídeo ou cole um link do Drive/YouTube.";
      if (hasDrive && !isLikelyUrl(data.driveLink))
        return "O link do Drive não parece um link válido. Confere?";
      if (hasDrive && !isDriveUrl(data.driveLink))
        return "Isso não parece um link do Google Drive. Cole o link de compartilhamento (drive.google.com).";
      if (hasYoutube && !isYouTubeUrl(data.youtubeLink))
        return "Isso não parece um link do YouTube. Cole o link (youtube.com ou youtu.be).";
    }
    if (p === 4 && !data.format) return "Escolha o formato.";
    return "";
  }

  function handleNext() {
    const e = validate(step);
    if (e) return setError(e);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      handleSubmit();
    }
  }

  function handlePrev() {
    setError("");
    if (step > 0) {
      setStep(step - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
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
        candidateNumber: data.candidateNumber,
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
        numeroEleitoral: data.candidateNumber,
        tituloEleitor: data.voterId,
      }),
    });
    const body = await resp.json().catch(() => null);
    setIsSubmitting(false);

    if (!resp.ok) {
      setError(body?.error ?? body?.erro ?? "Não deu pra criar a missão. Tenta de novo.");
      return;
    }
    clearDraft();
    setIsSubmitted(true);
  }

  if (isSubmitted) {
    return (
      <div className="mx-auto w-full max-w-lg px-5 py-16 text-center">
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
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
          Missão enviada!
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Ela já está na fila dos editores. Você acompanha o status na sua área e recebe o vídeo
          pronto por aqui.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/porta-voz" className="btn-gold">
            Ver minhas missões
          </Link>
          <button
            className="btn-ghost"
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
  const currentName = STEPS[step];

  return (
    <div className="mx-auto w-full max-w-xl px-5 pb-32 pt-6 lg:pb-12 lg:pt-10">
      {/* Progresso: quanto falta, em que ponto está, e se está salvo. */}
      <div className="mb-7" data-guia="passos-briefing">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-gold">
            Passo {step + 1} de {STEPS.length}
          </span>
          <span className="text-xs text-muted">{currentName}</span>
        </div>
        <div
          className="mt-2.5 flex gap-1.5"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-label={`Passo ${step + 1} de ${STEPS.length}: ${currentName}`}
        >
          {STEPS.map((name, i) => (
            <span
              key={name}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i < step ? "bg-gold-lo" : i === step ? "bg-gold" : "bg-line"
              }`}
            />
          ))}
        </div>

        {/* "Salvamento visual": a pessoa precisa ver que não vai perder o que digitou. */}
        <p className="mt-2.5 flex min-h-4 items-center gap-1.5 text-xs text-muted-2">
          {draftRestored ? (
            <>
              <span aria-hidden="true">↩</span>
              Rascunho de antes recuperado
            </>
          ) : draftSavedAt ? (
            <>
              <span aria-hidden="true" className="text-ok">
                ✓
              </span>
              Rascunho salvo neste aparelho
            </>
          ) : null}
        </p>
      </div>

      {step === 0 && (
        <StepContainer title="O vídeo bruto" subtitle="O material que o editor vai trabalhar.">
          <FieldWrapper label="Título da missão">
            <input
              className="field-input !pl-4"
              placeholder="ex.: Corte sobre segurança no bairro"
              value={data.title}
              onChange={(e) => setField("title", e.target.value)}
              autoFocus
            />
          </FieldWrapper>

          <UploadDropzone onUploadSuccess={(url) => setField("rawVideoUrl", url)} />

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs font-medium text-muted">ou cole um link</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <FieldWrapper label="Link do Drive" guide="campo-drive">
            <input
              className="field-input !pl-4"
              placeholder="cole o link de compartilhamento"
              value={data.driveLink}
              onChange={(e) => setField("driveLink", e.target.value)}
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
            />
            <TutorialButton onClick={() => setIsTutorialOpen(true)} />
          </FieldWrapper>

          <FieldWrapper label="Link do YouTube">
            <input
              className="field-input !pl-4"
              placeholder="cole o link do vídeo"
              value={data.youtubeLink}
              onChange={(e) => setField("youtubeLink", e.target.value)}
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
            />
          </FieldWrapper>
        </StepContainer>
      )}

      {step === 1 && (
        <StepContainer
          title="Objetivo da edição"
          subtitle="O que esse vídeo precisa fazer? Quanto mais claro, mais o editor acerta de primeira."
          optional
        >
          <FieldWrapper label="Por que esse vídeo importa">
            <textarea
              className="field-input !pl-4 min-h-32 resize-y"
              placeholder="ex.: resposta a um tema que bombou essa semana"
              value={data.reason}
              onChange={(e) => setField("reason", e.target.value)}
            />
          </FieldWrapper>

          <FieldWrapper label="Trechos ou cortes que precisam entrar">
            <textarea
              className="field-input !pl-4 min-h-28 resize-y"
              placeholder={"ex.: usar do minuto 3:20 ao 3:45\nlink de outro bruto pra encaixar"}
              value={data.extras}
              onChange={(e) => setField("extras", e.target.value)}
            />
          </FieldWrapper>
        </StepContainer>
      )}

      {step === 2 && (
        <StepContainer
          title="Referências"
          subtitle="O jeitão que você quer. Se não souber dizer, pode pular."
          optional
        >
          <FieldWrapper label="Vídeos ou estilos de referência">
            <textarea
              className="field-input !pl-4 min-h-24 resize-y"
              placeholder="ex.: estilo podcast, cortes secos"
              value={data.refs}
              onChange={(e) => setField("refs", e.target.value)}
            />
          </FieldWrapper>

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

          <FieldWrapper label="Fonte da legenda">
            <input
              className="field-input !pl-4"
              placeholder="ex.: bold condensada"
              value={data.font}
              onChange={(e) => setField("font", e.target.value)}
            />
          </FieldWrapper>
        </StepContainer>
      )}

      {step === 3 && (
        <StepContainer
          title="Orientações"
          subtitle="O que o editor precisa colocar no vídeo por obrigação."
        >
          <LegalNotice />

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
              inputMode="numeric"
            />
          </FieldWrapper>

          <FieldWrapper label="Número eleitoral">
            <input
              className="field-input !pl-4"
              placeholder="ex.: 13"
              value={data.candidateNumber}
              onChange={(e) => setField("candidateNumber", e.target.value.replace(/\D/g, ""))}
              maxLength={5}
              inputMode="numeric"
            />
          </FieldWrapper>
        </StepContainer>
      )}

      {step === 4 && (
        <StepContainer title="Formato" subtitle="Como você precisa do vídeo.">
          {/*
            ONDE O FORMATO LONGO (16:9) ESTÁ ESCONDIDO — aguardando decisão do dono.

            O formato `long` já é aceito de ponta a ponta; só não existe jeito de
            escolhê-lo. O caminho inteiro já suporta:
              - `lib/missions.ts`        → type VideoFormat = "short" | "long" | "longo"
              - `lib/missions.ts`        → FORMAT_LABEL.long = "Vídeo longo (16:9 · no YouTube)"
              - `app/api/missions/route.ts:17` → aceita "long" e o alias "longo"
              - `lib/missions-db.ts:152` → valida contra "short" | "long"
              - `supabase/schema.sql:92` → CHECK (format IN ('short', 'long'))
              - `lib/missions.ts`        → há missões de demonstração com format: "long"

            O único ponto que trava é este cartão fixo: ele não é um campo, é um
            rótulo. `data.format` nasce como "short" em EMPTY_FORM e nada escreve
            nele — por isso a validação `if (p === 4 && !data.format)` nunca falha.

            PRA LIBERAR: trocar este bloco por dois botões de escolha gravando
            setField("format", "short" | "long"). Nada de backend precisa mudar.
            NÃO FAZER sem o dono aprovar: liberar muda o que uma missão pode ser.
          */}
          <FieldWrapper label="Formato do vídeo">
            <div className="flex items-center gap-3 rounded-xl border border-gold bg-gold/10 px-4 py-3.5">
              <span
                aria-hidden="true"
                className="h-9 w-5 flex-none rounded-sm border-2 border-gold-hi"
              />
              <span>
                <span className="block text-sm font-medium text-text">Short 9:16</span>
                <span className="text-xs text-muted">vertical, até 90 segundos</span>
              </span>
            </div>
          </FieldWrapper>

          <FieldWrapper label="Prazo desejado (opcional)">
            <input
              type="date"
              className="field-input !pl-4"
              value={data.deadline}
              onChange={(e) => setField("deadline", e.target.value)}
            />
          </FieldWrapper>

          <p className="text-xs leading-relaxed text-muted-2">
            Ao enviar, a missão entra na fila e um editor da guilda pega. Você acompanha tudo na sua
            área.
          </p>
        </StepContainer>
      )}

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {/* No celular a dupla de botões fica fixa no rodapé: sempre ao alcance do
          polegar, sem precisar rolar até o fim de um passo comprido. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 px-5 py-3.5 backdrop-blur lg:static lg:mt-9 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3">
          {step > 0 ? (
            <button className="btn-ghost w-28 flex-none" onClick={handlePrev}>
              Voltar
            </button>
          ) : (
            <Link href="/porta-voz" className="btn-ghost w-28 flex-none text-center">
              Cancelar
            </Link>
          )}
          <button className="btn-gold flex-1" onClick={handleNext} disabled={isSubmitting}>
            {isSubmitting ? "Enviando…" : isLastStep ? "Enviar missão" : "Continuar"}
          </button>
        </div>
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
  optional,
  children,
}: {
  title: string;
  subtitle: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text">
          {title}
        </h1>
        {optional && (
          <span className="rounded-full border border-line bg-ink-2 px-2.5 py-0.5 text-xs text-muted-2">
            pode pular
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{subtitle}</p>
      <div className="mt-7 flex flex-col gap-5">{children}</div>
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
      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.1em] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
