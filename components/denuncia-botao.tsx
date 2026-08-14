"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LIMITES } from "@/lib/limites";

/**
 * Botão de denúncia da missão. O acusado é deduzido no servidor (quem
 * reporta aponta pro outro lado da missão) — aqui só se descreve o
 * problema. Vai direto pro painel do inspetor.
 */
export function DenunciaBotao({ pautaId }: { pautaId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [enviada, setEnviada] = useState(false);

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setErro("");
    try {
      const resp = await fetch(`/api/pautas/${pautaId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "denunciar", texto: t }),
      });
      if (!resp.ok) {
        const dados = await resp.json().catch(() => null);
        setErro(dados?.erro ?? "Não deu pra denunciar.");
        return;
      }
      setEnviada(true);
      setAberto(false);
      setTexto("");
      router.refresh();
    } catch {
      setErro("Sem conexão. Tenta de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviada) {
    return (
      <p className="rounded-xl border border-gold-lo/50 bg-gold/[0.07] px-4 py-3 text-sm text-text">
        Denúncia enviada. O controle de qualidade vai olhar.
      </p>
    );
  }

  return (
    <div>
      {!aberto ? (
        <button
          className="text-xs uppercase tracking-[0.12em] text-muted-2 transition-colors hover:text-danger"
          onClick={() => setAberto(true)}
        >
          🚩 Denunciar esta missão
        </button>
      ) : (
        <div className="rounded-xl border border-danger/30 bg-danger/[0.04] p-3">
          <label
            htmlFor={`denuncia-${pautaId}`}
            className="mb-2 block text-xs uppercase tracking-[0.12em] text-danger/90"
          >
            O que aconteceu?
          </label>
          <textarea
            id={`denuncia-${pautaId}`}
            className="field-input !pl-4 min-h-24 resize-y"
            placeholder="Descreva o problema — o controle de qualidade vai ler isto."
            value={texto}
            maxLength={LIMITES.denuncia}
            onChange={(e) => {
              setTexto(e.target.value);
              setErro("");
            }}
          />
          {erro && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {erro}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              className="btn-ghost flex-1 !border-danger/40 !text-danger hover:!bg-danger/10"
              onClick={() => void enviar()}
              disabled={enviando || !texto.trim()}
            >
              {enviando ? "Enviando…" : "Enviar denúncia"}
            </button>
            <button
              className="btn-ghost w-28"
              onClick={() => {
                setAberto(false);
                setTexto("");
                setErro("");
              }}
              disabled={enviando}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
