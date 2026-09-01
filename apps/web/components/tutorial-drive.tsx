"use client";

import {
  getEmbedUrl,
  type TipoTutorial,
  type TutorialType,
  VIDEOS,
} from "@oficina/domain/tutorials";
import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { GuideDemo } from "@/components/guide-demo";
import { ScreencastDrive } from "@/components/screencast-drive";

const STEPS: Record<string, { n: number; text: React.ReactNode }[]> = {
  drive: [
    { n: 1, text: <>Suba o vídeo na sua pasta</> },
    {
      n: 2,
      text: (
        <>
          Toque em <b className="font-medium text-text">Compartilhar</b>
        </>
      ),
    },
    {
      n: 3,
      text: (
        <>
          Acesso: <b className="font-medium text-text">qualquer pessoa com o link</b>
        </>
      ),
    },
    { n: 4, text: <>Copie o link e cole na Oficina</> },
  ],
  delivery: [
    {
      n: 1,
      text: (
        <>
          Suba o vídeo pronto no <b className="font-medium text-text">seu</b> Drive
        </>
      ),
    },
    {
      n: 2,
      text: (
        <>
          Toque em <b className="font-medium text-text">Compartilhar</b>
        </>
      ),
    },
    {
      n: 3,
      text: (
        <>
          Acesso: <b className="font-medium text-text">qualquer pessoa com o link</b>
        </>
      ),
    },
    { n: 4, text: <>Copie o link e confirme a entrega</> },
  ],
  entrega: [
    {
      n: 1,
      text: (
        <>
          Suba o vídeo pronto no <b className="font-medium text-text">seu</b> Drive
        </>
      ),
    },
    {
      n: 2,
      text: (
        <>
          Toque em <b className="font-medium text-text">Compartilhar</b>
        </>
      ),
    },
    {
      n: 3,
      text: (
        <>
          Acesso: <b className="font-medium text-text">qualquer pessoa com o link</b>
        </>
      ),
    },
    { n: 4, text: <>Copie o link e confirme a entrega</> },
  ],
};

const TITLE: Record<string, string> = {
  drive: "Como pegar o link do Drive",
  delivery: "Como entregar o vídeo pronto",
  entrega: "Como entregar o vídeo pronto",
};

export function TutorialDrive({
  type,
  tipo,
  isOpen,
  aberto,
  onClose,
  aoFechar,
}: {
  type?: TutorialType;
  tipo?: TipoTutorial;
  isOpen?: boolean;
  aberto?: boolean;
  onClose?: () => void;
  aoFechar?: () => void;
}) {
  const effectiveType = type ?? tipo ?? "drive";
  const effectiveOpen = isOpen ?? aberto ?? false;
  const handleClose = useCallback(() => {
    if (onClose) onClose();
    else if (aoFechar) aoFechar();
  }, [onClose, aoFechar]);

  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!effectiveOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    boxRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prev;
    };
  }, [effectiveOpen, handleClose]);

  if (!effectiveOpen) return null;

  const video = getEmbedUrl(VIDEOS[effectiveType as keyof typeof VIDEOS]);
  const stepsList = STEPS[effectiveType] ?? STEPS.drive;
  const titleText = TITLE[effectiveType] ?? TITLE.drive;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titleText}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
        aria-label="Fechar tutorial"
      />

      <div
        ref={boxRef}
        tabIndex={-1}
        className="relative flex max-h-[calc(100dvh-32px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gold-lo/60 bg-surface shadow-2xl outline-none"
      >
        <div className="flex flex-none items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text">
            {titleText}
          </h2>
          <button
            type="button"
            aria-label="Fechar"
            className="grid h-11 w-11 flex-none place-items-center rounded-lg text-muted transition-colors hover:text-text"
            onClick={handleClose}
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto p-5 sm:p-6">
          {video ? (
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-line bg-ink-2">
              <iframe
                src={video}
                title={titleText}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : effectiveType === "drive" ? (
            <ScreencastDrive />
          ) : (
            <GuideDemo type={effectiveType} />
          )}

          <ol className="grid gap-2 text-sm sm:grid-cols-4 sm:gap-3 sm:text-center">
            {stepsList.map((p) => (
              <li
                key={p.n}
                className="flex items-center gap-3 rounded-xl border border-line-soft bg-surface-2 p-3 sm:flex-col sm:gap-2"
              >
                <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-gold/10 text-xs font-semibold text-gold">
                  {p.n}
                </span>
                <span className="text-muted">{p.text}</span>
              </li>
            ))}
          </ol>

          <p className="text-xs text-muted-2">
            O vídeo nunca sai do seu Drive — a Oficina guarda só o link.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function TutorialButton({
  onClick,
  text = "Como pegar o link correto?",
  texto = "Como pegar o link correto?",
}: {
  onClick: () => void;
  text?: string;
  texto?: string;
}) {
  const label = text !== "Como pegar o link correto?" ? text : texto;
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 flex min-h-11 items-center gap-1.5 text-xs font-medium text-gold-hi transition-colors hover:text-gold"
    >
      <span
        aria-hidden="true"
        className="grid h-[18px] w-[18px] place-items-center rounded-full border border-gold/30 bg-gold/15 text-[8px]"
      >
        ▶
      </span>
      {label}
    </button>
  );
}

export { TutorialButton as BotaoTutorial };
