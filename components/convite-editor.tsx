"use client";

import { useState } from "react";

/**
 * Convite de editor: uma ação só, que faz a coisa certa em cada aparelho.
 *
 * No celular abre a folha de compartilhamento do sistema (WhatsApp, etc.);
 * onde ela não existe, copia o link. A URL absoluta é montada no CLIQUE, com
 * `window.location.origin` — nunca durante o render, senão o HTML do servidor
 * (sem `window`) e o do navegador divergiriam na hidratação. Por isso também
 * não existe campo mostrando a URL: o que é copiado é sempre o link completo.
 */
export function ConviteEditor({ codigo }: { codigo: string }) {
  const [aviso, setAviso] = useState<"copiado" | "erro" | null>(null);

  async function compartilhar() {
    const url = `${window.location.origin}/criar-conta?indicacao=${codigo}`;
    const texto = "Vem editar comigo na Oficina Amarela:";

    // folha nativa primeiro (é o caminho natural no celular)
    if (navigator.share) {
      try {
        await navigator.share({ title: "Oficina Amarela", text: texto, url });
        return;
      } catch {
        // cancelou ou não deu — cai no copiar, sem alarde
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setAviso("copiado");
      setTimeout(() => setAviso(null), 2200);
    } catch {
      setAviso("erro");
    }
  }

  return (
    <div>
      <p className="text-xs leading-relaxed text-muted">
        Cada editor que entrar pelo seu convite e tiver 2 vídeos aprovados
        rende pontos pra você.
      </p>

      <button type="button" onClick={compartilhar} className="btn-gold mt-3 flex items-center justify-center gap-2">
        {aviso === "copiado" ? (
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

      {aviso === "erro" && (
        <p role="alert" className="mt-2 text-xs text-danger">
          Não deu pra copiar aqui. Seu código de convite é{" "}
          <b className="font-medium text-text">{codigo}</b>.
        </p>
      )}

      <p className="mt-2 text-[11px] text-muted-2">
        Código: <span className="text-muted">{codigo}</span>
      </p>
    </div>
  );
}
