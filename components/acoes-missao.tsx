"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * O último passo do ciclo, do lado de quem pediu o vídeo.
 *
 * Aparece em dois momentos, e a diferença importa:
 *
 *  - 'em_revisao': o editor acabou de entregar. Antes esta tela ficava calada
 *    aqui e a missão esperava o inspetor aparecer — com o vídeo pronto e o
 *    editor sem receber a próxima nem a pontuação. Agora quem pediu já libera,
 *    dando a nota, e a missão fecha na hora.
 *  - 'aprovada': o inspetor passou primeiro. Aí falta só o aceite, sem nota
 *    (ela já foi dada por ele).
 *
 * Fala com a mesma rota que o editor e o inspetor usam (/api/pautas/[id]),
 * que é onde todas as transições vivem.
 */
export function AcoesMissao({
  id,
  emRevisao = false,
}: {
  id: string;
  /** true quando o vídeo acabou de ser entregue e ninguém conferiu ainda */
  emRevisao?: boolean;
}) {
  const router = useRouter();
  const [processando, setProcessando] = useState<"aceitar" | "ajuste" | "aprovar" | null>(null);
  const [abrindoAjuste, setAbrindoAjuste] = useState(false);
  const [notas, setNotas] = useState("");
  const [estrelas, setEstrelas] = useState<number | undefined>(undefined);
  const [aviso, setAviso] = useState("");

  async function enviar(acao: "aceitar" | "ajuste" | "aprovar") {
    if (acao === "ajuste" && !notas.trim()) {
      setAviso("Escreva o que precisa mudar.");
      return;
    }
    setAviso("");
    setProcessando(acao);

    // com o vídeo ainda em revisão, aceitar é aprovar: fecha a missão e
    // pontua o editor de uma vez. Já aprovada, é só o aceite final.
    const corpo =
      acao === "ajuste"
        ? { acao, notas: notas.trim() }
        : emRevisao
          ? { acao: "aprovar", nota: estrelas }
          : { acao };

    const resp = await fetch(`/api/pautas/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
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
        {emRevisao
          ? "O editor entregou. Assista e diga se pode ir pro ar — ou peça um ajuste antes."
          : "O controle de qualidade já aprovou. Assista ao vídeo e diga se pode ir pro ar — ou peça um ajuste antes."}
      </p>

      {/* A nota só aparece pra quem está fechando a missão pela primeira vez.
          Com a missão já 'aprovada', o inspetor passou antes e a nota dele já
          está registrada — pedir de novo criaria duas avaliações do mesmo
          trabalho. Opcional de propósito: obrigar nota faria gente clicar
          qualquer estrela pra se livrar da tela, e aí o ranking mente. */}
      {emRevisao && !abrindoAjuste && (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-[0.12em] text-muted">
            Que nota o editor merece? <span className="text-muted-2">(opcional)</span>
          </p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} de 5`}
                aria-pressed={estrelas === n}
                onClick={() => setEstrelas(estrelas === n ? undefined : n)}
                className={`text-2xl leading-none transition-colors ${
                  estrelas !== undefined && n <= estrelas
                    ? "text-gold"
                    : "text-line hover:text-gold-lo"
                }`}
              >
                ★
              </button>
            ))}
            {estrelas !== undefined && (
              <button
                type="button"
                className="ml-2 text-xs text-muted-2 underline hover:text-muted"
                onClick={() => setEstrelas(undefined)}
              >
                limpar
              </button>
            )}
          </div>
        </div>
      )}

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

          <div className="mt-5 flex flex-col gap-3 sm:flex-row" data-guia="aprovar-missao">
            <button
              className="btn-gold sm:flex-1"
              onClick={() => enviar(emRevisao ? "aprovar" : "aceitar")}
              disabled={processando !== null}
            >
              {processando === "aceitar"
                ? "Fechando…"
                : emRevisao
                  ? "✅ Aprovar e fechar"
                  : "✅ Aceitar e postar"}
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
