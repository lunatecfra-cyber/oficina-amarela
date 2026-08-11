"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * O último passo do ciclo, do lado de quem pediu o vídeo.
 *
 * Só aparece quando a missão está 'aprovada' — ou seja, o inspetor já liberou
 * e agora falta o porta-voz conferir. Daqui saem os dois caminhos: aceitar
 * (fecha a missão) ou pedir um ajuste (devolve pro mesmo editor).
 *
 * Fala com a mesma rota que o editor e o inspetor usam (/api/pautas/[id]),
 * que é onde todas as transições vivem.
 */
export function AcoesMissao({ id }: { id: string }) {
  const router = useRouter();
  const [processando, setProcessando] = useState<"aceitar" | "ajuste" | null>(null);
  const [abrindoAjuste, setAbrindoAjuste] = useState(false);
  const [notas, setNotas] = useState("");
  const [aviso, setAviso] = useState("");

  async function enviar(acao: "aceitar" | "ajuste") {
    if (acao === "ajuste" && !notas.trim()) {
      setAviso("Escreva o que precisa mudar.");
      return;
    }
    setAviso("");
    setProcessando(acao);

    const resp = await fetch(`/api/pautas/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(acao === "ajuste" ? { acao, notas: notas.trim() } : { acao }),
    });

    if (!resp.ok) {
      const dados = await resp.json().catch(() => null);
      setAviso(dados?.erro ?? "Não deu pra concluir. Tenta de novo.");
      setProcessando(null);
      return;
    }

    setProcessando(null);
    setAbrindoAjuste(false);
    setNotas("");
    router.refresh();
  }

  return (
    <section className="mb-8 rounded-2xl border border-gold-lo/50 bg-gradient-to-b from-gold/[0.07] to-transparent p-5 lg:p-6">
      <p className="text-xs uppercase tracking-[0.14em] text-gold-hi">
        Sua vez de conferir
      </p>
      <p className="mt-2 text-sm text-muted">
        O controle de qualidade já aprovou. Assista ao vídeo e diga se pode ir
        pro ar — ou peça um ajuste antes.
      </p>

      {abrindoAjuste ? (
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
            value={notas}
            onChange={(e) => {
              setNotas(e.target.value);
              setAviso("");
            }}
            autoFocus
          />

          {aviso && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {aviso}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              className="btn-gold sm:flex-1"
              onClick={() => enviar("ajuste")}
              disabled={processando !== null}
            >
              {processando === "ajuste" ? "Enviando…" : "Enviar pro editor"}
            </button>
            <button
              className="btn-ghost sm:w-40"
              onClick={() => {
                setAbrindoAjuste(false);
                setAviso("");
              }}
              disabled={processando !== null}
            >
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <>
          {aviso && (
            <p role="alert" className="mt-4 text-sm text-danger">
              {aviso}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              className="btn-gold sm:flex-1"
              onClick={() => enviar("aceitar")}
              disabled={processando !== null}
            >
              {processando === "aceitar" ? "Fechando…" : "✅ Aceitar e postar"}
            </button>
            <button
              className="btn-ghost sm:w-48"
              onClick={() => setAbrindoAjuste(true)}
              disabled={processando !== null}
            >
              💬 Pedir ajuste
            </button>
          </div>
        </>
      )}
    </section>
  );
}
