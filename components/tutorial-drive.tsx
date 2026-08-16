"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { DemoGuia } from "@/components/demo-guia";
import { urlDeEmbutir, VIDEOS, type TipoTutorial } from "@/lib/tutoriais";

/**
 * A janelinha "Como pegar o link do Drive".
 *
 * O miolo de vídeo funciona sozinho: se houver link em lib/tutoriais.ts, toca
 * o vídeo; se não houver, mostra a animação. Nunca fica um retângulo vazio
 * esperando alguém lembrar de gravar.
 */

const PASSOS: Record<TipoTutorial, { n: number; texto: React.ReactNode }[]> = {
  drive: [
    { n: 1, texto: <>Suba o vídeo na sua pasta</> },
    { n: 2, texto: <>Toque em <b className="font-medium text-text">Compartilhar</b></> },
    { n: 3, texto: <>Acesso: <b className="font-medium text-text">qualquer pessoa com o link</b></> },
    { n: 4, texto: <>Copie o link e cole na Oficina</> },
  ],
  entrega: [
    { n: 1, texto: <>Suba o vídeo pronto no <b className="font-medium text-text">seu</b> Drive</> },
    { n: 2, texto: <>Toque em <b className="font-medium text-text">Compartilhar</b></> },
    { n: 3, texto: <>Acesso: <b className="font-medium text-text">qualquer pessoa com o link</b></> },
    { n: 4, texto: <>Copie o link e confirme a entrega</> },
  ],
};

const TITULO: Record<TipoTutorial, string> = {
  drive: "Como pegar o link do Drive",
  entrega: "Como entregar o vídeo pronto",
};

export function TutorialDrive({
  tipo,
  aberto,
  aoFechar,
}: {
  tipo: TipoTutorial;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const caixaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", tecla);

    // trava a rolagem do fundo: sem isto, rolar dentro da janelinha no celular
    // arrasta o formulário atrás dela
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    caixaRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = antes;
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  const video = urlDeEmbutir(VIDEOS[tipo]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={TITULO[tipo]}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/80 backdrop-blur-sm"
        onClick={aoFechar}
        aria-label="Fechar tutorial"
      />

      {/* max-h + rolagem interna: com os quatro passos empilhados, no celular
          a janela passava da tela e o botão de fechar ficava fora do alcance */}
      <div
        ref={caixaRef}
        tabIndex={-1}
        className="relative flex max-h-[calc(100dvh-32px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gold-lo/60 bg-surface shadow-2xl outline-none"
      >
        <div className="flex flex-none items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text">
            {TITULO[tipo]}
          </h2>
          <button
            type="button"
            aria-label="Fechar"
            className="grid h-11 w-11 flex-none place-items-center rounded-lg text-muted transition-colors hover:text-text"
            onClick={aoFechar}
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto p-5 sm:p-6">
          {video ? (
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-line bg-ink-2">
              <iframe
                src={video}
                title={TITULO[tipo]}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <DemoGuia tipo={tipo} />
          )}

          <ol className="grid gap-2 text-sm sm:grid-cols-4 sm:gap-3 sm:text-center">
            {PASSOS[tipo].map((p) => (
              <li
                key={p.n}
                className="flex items-center gap-3 rounded-xl border border-line-soft bg-surface-2 p-3 sm:flex-col sm:gap-2"
              >
                <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-gold/10 text-xs font-semibold text-gold">
                  {p.n}
                </span>
                <span className="text-muted">{p.texto}</span>
              </li>
            ))}
          </ol>

          <p className="text-xs text-muted-2">
            O vídeo nunca sai do seu Drive — a Oficina guarda só o link.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** O gatilho: um link discreto, com alvo de dedo. */
export function BotaoTutorial({
  onClick,
  texto = "Como pegar o link correto?",
}: {
  onClick: () => void;
  texto?: string;
}) {
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
      {texto}
    </button>
  );
}
