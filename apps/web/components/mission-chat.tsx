"use client";

import { LIMITS } from "@oficina/domain/limits";
import { ATTACHMENT_MAX_BYTES, validateChatAttachment } from "@oficina/domain/uploads";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, Mensagem } from "@/lib/chat-db";

const ROLE_LABEL: Record<string, string> = {
  spokesperson: "Candidato",
  voz: "Candidato",
  editor: "Editor",
  admin: "Administrador",
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
    ),
  );
}

const POLL_MS = 5_000;

type TimelineEvent = { id: string; event: string; version: number; at: string };

const EVENT_LABEL: Record<string, (version: number) => string> = {
  accepted: () => "O editor aceitou a missão",
  submitted: (v) => `Entrega da versão ${v} enviada`,
  revision: (v) => `Reedição pedida na versão ${v}`,
  inspection_approved: (v) => `Inspeção da versão ${v}: aprovada`,
  inspection_rejected: (v) => `Inspeção da versão ${v}: ajustes pedidos`,
  approved: () => "Missão concluída",
  returned: () => "Missão devolvida ao mural",
};

function formatSize(bytes: number): string {
  return bytes >= 1024 ** 2
    ? `${(bytes / 1024 ** 2).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function seqOf(m: ChatMessage): number {
  return m.seq ?? (Number(String(m.id).replace(/^m-/, "")) || 0);
}

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
  const effectiveInitial =
    initialMessages && initialMessages.length > 0 ? initialMessages : (mensagensIniciais ?? []);
  const allowSend = canSend && podeEnviar;
  const isCompact = compact || compacto;

  const [messages, setMessages] = useState<ChatMessage[]>(effectiveInitial as any);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  const endRef = useRef<HTMLLIElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // The cursor is the message id: timestamps repeat when two messages arrive together.
  const lastSeq = messages.reduce((max, m) => Math.max(max, seqOf(m)), 0);
  const readRef = useRef(0);

  const poll = useCallback(async () => {
    try {
      const resp = await fetch(
        `/api/missions/${effectiveId}?afterId=${lastSeq}&limit=100&events=1`,
        {
          cache: "no-store",
        },
      );
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data.events)) setEvents(data.events);
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
  }, [effectiveId, lastSeq]);

  const markRead = useCallback(async () => {
    if (lastSeq <= readRef.current || document.visibilityState !== "visible") return;
    readRef.current = lastSeq;
    try {
      const resp = await fetch(`/api/missions/${effectiveId}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upTo: lastSeq }),
      });
      if (!resp.ok) readRef.current = 0;
    } catch {
      readRef.current = 0; // retry on the next change
    }
  }, [effectiveId, lastSeq]);

  useEffect(() => {
    if (!/^\d+$/.test(effectiveId.replace(/^db-/, ""))) return;
    void markRead();
    const onVisible = () => void markRead();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [effectiveId, markRead]);

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

  // Messages and lifecycle events on a single line, ordered by time.
  const timeline = [
    ...messages.map((m) => ({
      kind: "message" as const,
      at: m.createdAt ?? (m as any).criadaEm ?? "",
      m,
    })),
    ...events.map((e) => ({ kind: "event" as const, at: e.at, e })),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  useEffect(() => {
    if (timeline.length > 0) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [timeline.length]);

  async function send() {
    const t = text.trim();
    if ((!t && !file) || isSending) return;
    setIsSending(true);
    setError("");
    try {
      let resp: Response;
      if (file) {
        const form = new FormData();
        form.set("file", file);
        if (t) form.set("text", t);
        resp = await fetch(`/api/missions/${effectiveId}/attachments`, {
          method: "POST",
          body: form,
        });
      } else {
        resp = await fetch(`/api/missions/${effectiveId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "message", text: t, acao: "mensagem", texto: t }),
        });
      }
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        setError(data?.error ?? data?.erro ?? "Não deu pra enviar.");
        return;
      }
      setText("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      void poll();
    } catch {
      setError("Sem conexão. Tenta de novo.");
    } finally {
      setIsSending(false);
    }
  }

  function pickFile(picked: File | null) {
    setError("");
    if (picked) {
      const policy = validateChatAttachment(picked.type, picked.size);
      if (!policy.ok) {
        setError(policy.error);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }
    setFile(picked);
  }

  return (
    <section className="rounded-2xl border border-line bg-surface/70 p-4 lg:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text">
          Conversa da missão
        </h2>
        <span className="text-xs text-muted">
          {messages.length} {messages.length === 1 ? "mensagem" : "mensagens"}
        </span>
      </div>

      {messages.length === 0 && events.length === 0 ? (
        <p className="rounded-xl border border-line-soft bg-ink-2/40 px-4 py-3 text-sm text-muted">
          Ninguém falou ainda. Pergunta, combina detalhes do vídeo. Fica tudo registrado aqui.
        </p>
      ) : (
        <ul
          className={`flex flex-col gap-2 ${isCompact ? "max-h-64" : "max-h-96"} overflow-y-auto pr-1`}
        >
          {timeline.map((item) => {
            if (item.kind === "event") {
              const label = EVENT_LABEL[item.e.event];
              if (!label) return null;
              return (
                <li key={item.e.id} className="px-2 py-1 text-center text-[11px] text-muted-2">
                  {label(item.e.version)} · {formatTime(item.e.at)}
                </li>
              );
            }
            const m = item.m;
            const authorName = m.authorName ?? (m as any).autorNome;
            const authorRole = m.authorRole ?? (m as any).autorPapel;
            const createdAt = m.createdAt ?? (m as any).criadaEm;
            const content = m.text ?? (m as any).texto;
            const isAdmin =
              String(authorRole) === "admin" ||
              String(authorRole) === "inspector" ||
              String(authorRole) === "inspetor";

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
                <p className="mt-1 whitespace-pre-line break-words text-sm text-text/90">
                  {textWithLinks(content)}
                </p>
                {m.attachments?.map((a) => {
                  const href = `/api/missions/${effectiveId}/attachments/${a.id}`;
                  return (
                    <div key={a.id} className="mt-2">
                      {a.contentType.startsWith("image/") && (
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          <img
                            src={href}
                            alt={a.filename}
                            loading="lazy"
                            className="max-h-40 rounded-lg border border-line"
                          />
                        </a>
                      )}
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-xs text-gold-hi underline underline-offset-2"
                      >
                        {a.filename} · {formatSize(a.size)}
                      </a>
                    </div>
                  );
                })}
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
              disabled={isSending || (!text.trim() && !file)}
            >
              {isSending ? "Enviando…" : "Enviar"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <label className="cursor-pointer rounded-lg border border-line px-3 py-1.5 hover:bg-ink-2/60">
              Anexar imagem ou PDF
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="sr-only"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {file ? (
              <span>
                {file.name} · {formatSize(file.size)}{" "}
                <button type="button" className="underline" onClick={() => pickFile(null)}>
                  remover
                </button>
              </span>
            ) : (
              <span>até {ATTACHMENT_MAX_BYTES / 1024 ** 2} MB</span>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          )}
          <p className="mt-3 text-xs text-muted">
            Algo deu errado de verdade?{" "}
            <Link
              href={`/disputas/nova?missao=${effectiveId.replace(/^db-/, "")}`}
              className="underline underline-offset-2 hover:text-text"
            >
              Abrir disputa
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}

export { MissionChat as ChatMissao };
