"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ChatMessage, Mensagem } from "@/lib/chat-db";
import { LIMITS } from "@/lib/limits";

const ROLE_LABEL: Record<string, string> = {
  spokesperson: "Candidato",
  voz: "Candidato",
  editor: "Editor",
  admin: "Inspetor",
  inspector: "Inspetor",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function textWithLinks(text: string): React.ReactNode[] {
  const parts = text.split(/(https?:\/\/\S+)/g);
  if (parts.length === 1) return [text];
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gold-hi underline underline-offset-2 hover:no-underline"
      >
        {part}
      </a>
    ) : (
      part
    )
  );
}

const POLL_MS = 5_000;

export function MissionChat({
  missionId,
  pautaId,
  messages: initialMessages,
  mensagens: mensagensIniciais,
  canSend = true,
  podeEnviar = true,
  compact = false,
  compacto = false,
}: {
  missionId?: string;
  pautaId?: string;
  messages?: ChatMessage[];
  mensagens?: Mensagem[];
  canSend?: boolean;
  podeEnviar?: boolean;
  compact?: boolean;
  compacto?: boolean;
}) {
  const effectiveId = missionId ?? pautaId ?? "";
  const effectiveInitial = (initialMessages && initialMessages.length > 0)
    ? initialMessages
    : (mensagensIniciais ?? []);
  const allowSend = canSend && podeEnviar;
  const isCompact = compact || compacto;

  const [messages, setMessages] = useState<ChatMessage[]>(effectiveInitial as any);
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  const endRef = useRef<HTMLLIElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lastTs = messages.length > 0 ? (messages[messages.length - 1].createdAt ?? (messages[messages.length - 1] as any).criadaEm) : null;

  const poll = useCallback(async () => {
    try {
      const params = lastTs ? `?after=${encodeURIComponent(lastTs)}` : "";
      const resp = await fetch(`/api/missions/${effectiveId}${params}`);
      if (!resp.ok) return;
      const data = await resp.json();
      const newMessages: ChatMessage[] = data.messages ?? data.mensagens ?? [];
      if (newMessages.length > 0) {
        setMessages((prev) => {
          const existing = new Set(prev.map((m) => m.id));
          const filtered = newMessages.filter((m) => !existing.has(m.id));
          return filtered.length > 0 ? [...prev, ...filtered] : prev;
        });
      }
    } catch {
      // network failure
    }
  }, [effectiveId, lastTs]);

  useEffect(() => {
    if (!effectiveId || !/^\d+$/.test(effectiveId.replace(/^db-/, ""))) return;

    function start() {
      void poll();
      timerRef.current = setInterval(() => void poll(), POLL_MS);
    }

    function stop() {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    start();

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        void poll();
        start();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [effectiveId, poll]);

  useEffect(() => {
    if (messages.length > 0) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length]);

  async function send() {
    const t = text.trim();
    if (!t || isSending) return;
    setIsSending(true);
    setError("");
    try {
      const resp = await fetch(`/api/missions/${effectiveId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "message", text: t, acao: "mensagem", texto: t }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        setError(data?.error ?? data?.erro ?? "Não deu pra enviar.");
        return;
      }
      setText("");
      void poll();
    } catch {
      setError("Sem conexão. Tenta de novo.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface/70 p-4 lg:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text">
          Conversa da missão
        </h2>
        <span className="text-xs text-muted">{messages.length} {messages.length === 1 ? "mensagem" : "mensagens"}</span>
      </div>

      {messages.length === 0 ? (
        <p className="rounded-xl border border-line-soft bg-ink-2/40 px-4 py-3 text-sm text-muted">
          Ninguém falou ainda. Pergunta, combina detalhes do vídeo — fica tudo registrado aqui.
        </p>
      ) : (
        <ul className={`flex flex-col gap-2 ${isCompact ? "max-h-64" : "max-h-96"} overflow-y-auto pr-1`}>
          {messages.map((m) => {
            const authorName = m.authorName ?? (m as any).autorNome;
            const authorRole = m.authorRole ?? (m as any).autorPapel;
            const createdAt = m.createdAt ?? (m as any).criadaEm;
            const content = m.text ?? (m as any).texto;
            const isAdmin = String(authorRole) === "admin" || String(authorRole) === "inspector" || String(authorRole) === "inspetor";

            return (
              <li key={m.id} className="rounded-xl border border-line bg-ink-2/50 px-3.5 py-2.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-medium text-text">{authorName}</span>
                  <span
                    className={`rounded px-1.5 py-px text-[10px] font-medium uppercase tracking-wider ${
                      isAdmin
                        ? "border border-gold-lo/60 bg-gold/10 text-gold-hi"
                        : "border border-line text-muted"
                    }`}
                  >
                    {ROLE_LABEL[authorRole] ?? authorRole}
                  </span>
                  <span className="ml-auto text-[11px] text-muted-2">{formatTime(createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-line break-words text-sm text-text/90">{textWithLinks(content)}</p>
              </li>
            );
          })}
          <li ref={endRef} className="h-0" aria-hidden="true" />
        </ul>
      )}

      {allowSend && (
        <div className="mt-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea
              className="field-input !pl-4 min-h-11 flex-1 resize-y"
              placeholder="Escrever na conversa…"
              value={text}
              maxLength={LIMITS.message}
              onChange={(e) => {
                setText(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void send();
              }}
              rows={2}
            />
            <button
              className="btn-gold sm:w-32"
              onClick={() => void send()}
              disabled={isSending || !text.trim()}
            >
              {isSending ? "Enviando…" : "Enviar"}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export { MissionChat as ChatMissao };
