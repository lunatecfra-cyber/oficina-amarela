"use client";

import { useState } from "react";

/**
 * Editor invitation: shareable link with native sheet or clipboard fallback.
 * Public interface text in Portuguese (PT-BR).
 */
export function EditorInvitation({
  code,
  codigo,
}: {
  code?: string;
  codigo?: string;
}) {
  const referralCode = code ?? codigo ?? "";
  const [notice, setNotice] = useState<"copied" | "error" | null>(null);

  async function handleShare() {
    const url = `${window.location.origin}/criar-conta?indicacao=${referralCode}`;
    const text = "Vem editar comigo na Oficina Amarela:";

    if (navigator.share) {
      try {
        await navigator.share({ title: "Oficina Amarela", text, url });
        return;
      } catch {
        // Fallback to clipboard on cancel or error
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setNotice("copied");
      setTimeout(() => setNotice(null), 2200);
    } catch {
      setNotice("error");
    }
  }

  return (
    <div>
      <p className="text-xs leading-relaxed text-muted">
        Cada editor que entrar pelo seu convite e tiver 2 vídeos aprovados
        rende pontos pra você.
      </p>

      <button type="button" onClick={handleShare} className="btn-gold mt-3 flex items-center justify-center gap-2">
        {notice === "copied" ? (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-4 w-4" aria-hidden="true">
              <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Link copiado
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
              <path d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" strokeLinecap="round" />
            </svg>
            Compartilhar convite
          </>
        )}
      </button>

      {notice === "error" && (
        <p role="alert" className="mt-2 text-xs text-danger">
          Não deu pra copiar aqui. Seu código de convite é{" "}
          <b className="font-medium text-text">{referralCode}</b>.
        </p>
      )}

      <p className="mt-2 text-[11px] text-muted-2">
        Código: <span className="text-muted">{referralCode}</span>
      </p>
    </div>
  );
}

export const ConviteEditor = EditorInvitation;
