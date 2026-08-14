"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Mensagem } from "@/lib/chat-db";
import { LIMITES } from "@/lib/limites";

const ROTULO_PAPEL: Record<Mensagem["autorPapel"], string> = {
  voz: "Candidato",
  editor: "Editor",
  admin: "Inspetor",
};

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Thread da missão: candidato, editor (enquanto a missão for dele) e inspetor
 * conversam preso ao contexto. Sem tempo real — após enviar, router.refresh()
 * traz a mensagem nova junto com o resto da página (mesmo padrão das ações
 * de missão que já existem).
 */
export function ChatMissao({
  pautaId,
  mensagens,
  podeEnviar = true,
  compacto = false,
}: {
  pautaId: string; // "db-123", como o id circula nas telas
  mensagens: Mensagem[];
  podeEnviar?: boolean;
  compacto?: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setErro("");
    try {
      const resp = await fetch(`/api/pautas/${pautaId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "mensagem", texto: t }),
      });
      if (!resp.ok) {
        const dados = await resp.json().catch(() => null);
        setErro(dados?.erro ?? "Não deu pra enviar.");
        return;
      }
      setTexto("");
      router.refresh();
    } catch {
      setErro("Sem conexão. Tenta de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface/70 p-4 lg:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text">
          Conversa da missão
        </h2>
        <span className="text-xs text-muted">{mensagens.length} mensagem{mensagens.length === 1 ? "" : "es"}</span>
      </div>

      {mensagens.length === 0 ? (
        <p className="rounded-xl border border-line-soft bg-ink-2/40 px-4 py-3 text-sm text-muted">
          Ninguém falou ainda. Pergunta, combina detalhes do vídeo — fica tudo registrado aqui.
        </p>
      ) : (
        <ul className={`flex flex-col gap-2 ${compacto ? "max-h-64" : "max-h-96"} overflow-y-auto pr-1`}>
          {mensagens.map((m) => (
            <li key={m.id} className="rounded-xl border border-line bg-ink-2/50 px-3.5 py-2.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium text-text">{m.autorNome}</span>
                <span
                  className={`rounded px-1.5 py-px text-[10px] font-medium uppercase tracking-wider ${
                    m.autorPapel === "admin"
                      ? "border border-gold-lo/60 bg-gold/10 text-gold-hi"
                      : "border border-line text-muted"
                  }`}
                >
                  {ROTULO_PAPEL[m.autorPapel]}
                </span>
                <span className="ml-auto text-[11px] text-muted-2">{hora(m.criadaEm)}</span>
              </div>
              <p className="mt-1 whitespace-pre-line break-words text-sm text-text/90">{m.texto}</p>
            </li>
          ))}
        </ul>
      )}

      {podeEnviar && (
        <div className="mt-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea
              className="field-input !pl-4 min-h-11 flex-1 resize-y"
              placeholder="Escrever na conversa…"
              value={texto}
              maxLength={LIMITES.mensagem}
              onChange={(e) => {
                setTexto(e.target.value);
                setErro("");
              }}
              onKeyDown={(e) => {
                // Ctrl/Cmd+Enter envia — Enter quebra linha (texto multilinha é natural no chat)
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void enviar();
              }}
              rows={2}
            />
            <button
              className="btn-gold sm:w-32"
              onClick={() => void enviar()}
              disabled={enviando || !texto.trim()}
            >
              {enviando ? "Enviando…" : "Enviar"}
            </button>
          </div>
          {erro && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {erro}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
