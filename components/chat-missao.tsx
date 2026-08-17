"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

/** Converte URLs no texto em links clicáveis (abrem em nova aba). */
function textoComLinks(texto: string): React.ReactNode[] {
  const partes = texto.split(/(https?:\/\/\S+)/g);
  if (partes.length === 1) return [texto];
  return partes.map((parte, i) =>
    /^https?:\/\//.test(parte) ? (
      <a
        key={i}
        href={parte}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gold-hi underline underline-offset-2 hover:no-underline"
      >
        {parte}
      </a>
    ) : (
      parte
    )
  );
}

/** Intervalo de polling (ms). */
const POLL_MS = 5_000;

/**
 * Thread da missão: candidato, editor (enquanto a missão for dele) e inspetor
 * conversam preso ao contexto.
 *
 * Auto-atualiza a cada 5s via polling na API — sem F5.
 * Pausa quando a aba não está visível e volta quando o usuário volta.
 * Faz auto-scroll suave quando chegam mensagens novas.
 */
export function ChatMissao({
  pautaId,
  mensagens: mensagensIniciais,
  podeEnviar = true,
  compacto = false,
}: {
  pautaId: string; // "db-123", como o id circula nas telas
  mensagens: Mensagem[];
  podeEnviar?: boolean;
  compacto?: boolean;
}) {
  // mensagens em estado local — o componente gerencia o próprio conteúdo via polling
  const [mensagens, setMensagens] = useState<Mensagem[]>(mensagensIniciais);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  // ref pro scroll: última mensagem da lista
  const fimRef = useRef<HTMLLIElement>(null);
  // ref pro timer de polling
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // último timestamp conhecido — base pra pedir só o que vem depois
  const ultimoTs = mensagens.length > 0 ? mensagens[mensagens.length - 1].criadaEm : null;

  /** Busca mensagens novas e adiciona ao estado local. */
  const poll = useCallback(async () => {
    try {
      const params = ultimoTs ? `?depois=${encodeURIComponent(ultimoTs)}` : "";
      const resp = await fetch(`/api/pautas/${pautaId}${params}`);
      if (!resp.ok) return;
      const { mensagens: novas } = (await resp.json()) as { mensagens: Mensagem[] };
      if (novas.length > 0) {
        setMensagens((prev) => {
          // evita duplicatas usando o id
          const existentes = new Set(prev.map((m) => m.id));
          const filtradas = novas.filter((m) => !existentes.has(m.id));
          return filtradas.length > 0 ? [...prev, ...filtradas] : prev;
        });
      }
    } catch {
      // rede caiu? tenta de novo no próximo ciclo
    }
  }, [pautaId, ultimoTs]);

  // polling: monta timer, pausa quando aba não está visível
  useEffect(() => {
    if (!pautaId || !/^\d+$/.test(pautaId.replace(/^db-/, ""))) return;

    function iniciar() {
      // poll imediato, depois a cada POLL_MS
      void poll();
      timerRef.current = setInterval(() => void poll(), POLL_MS);
    }

    function parar() {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    iniciar();

    // pausa quando o usuário troca de aba — economiza requests
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        parar();
      } else {
        // quando volta, poll imediato pra pegar o que perdeu
        void poll();
        iniciar();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      parar();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pautaId, poll]);

  // auto-scroll suave quando chegam mensagens novas
  useEffect(() => {
    if (mensagens.length > 0) {
      fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [mensagens.length]);

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
      // poll imediato pra mostrar a mensagem que acabou de enviar
      void poll();
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
        <span className="text-xs text-muted">{mensagens.length} {mensagens.length === 1 ? "mensagem" : "mensagens"}</span>
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
              <p className="mt-1 whitespace-pre-line break-words text-sm text-text/90">{textoComLinks(m.texto)}</p>
            </li>
          ))}
          {/* âncora invisível pro auto-scroll */}
          <li ref={fimRef} className="h-0" aria-hidden="true" />
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
