"use client";

import { useCallback, useEffect, useState } from "react";
import { MissionChat } from "@/components/mission-chat";
import type { ChatMessage } from "@/lib/chat-db";

type OwnerNotification = {
  id: string;
  missionId: number;
  action: string;
  reason: string;
  createdAt: string;
};

function PreviousConversation({ missionId }: { missionId: number }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/missions/${missionId}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.messages)) throw new Error("history");
      setMessages(data.messages);
    } catch {
      setError("Não foi possível carregar sua conversa anterior.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        className="min-h-11 text-sm text-gold-hi underline"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) void load();
        }}
      >
        {open ? "Fechar conversa anterior" : "Ver conversa anterior"}
      </button>
      {open && (
        <div className="mt-2">
          {loading && (
            <p role="status" className="text-sm text-muted">
              Carregando conversa…
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}{" "}
              <button type="button" className="underline" onClick={() => void load()}>
                Tentar novamente
              </button>
            </p>
          )}
          {!loading && !error && messages && (
            <MissionChat
              missionId={String(missionId)}
              messages={messages}
              readOnly
              polling={false}
              showAssignmentSegments
            />
          )}
        </div>
      )}
    </div>
  );
}

export function EditorOwnerNotifications() {
  const [notifications, setNotifications] = useState<OwnerNotification[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/missions/owner-notifications", {
        cache: "no-store",
        signal,
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true || !Array.isArray(data.notifications))
        throw new Error("notifications");
      if (!signal?.aborted) setNotifications(data.notifications);
    } catch {
      if (!signal?.aborted) setError("Não foi possível carregar os avisos das missões.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (!notifications.length && !error) return null;
  return (
    <section className="mb-6 border-y border-line py-4" aria-label="Avisos das missões">
      <h2 className="text-base font-semibold text-text">Avisos das missões</h2>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}{" "}
          <button
            type="button"
            className="underline"
            disabled={loading}
            onClick={() => void load()}
          >
            Tentar novamente
          </button>
        </p>
      )}
      <ul className="divide-y divide-line">
        {notifications.map((notification) => (
          <li key={notification.id} className="py-3">
            <p className="text-sm font-medium text-text">
              Missão #{notification.missionId}:{" "}
              {notification.action === "cancel_mission"
                ? "cancelada pelo proprietário"
                : notification.action === "reassign_mission"
                  ? "devolvida à fila para outro editor"
                  : "atualizada pelo proprietário"}
            </p>
            <time dateTime={notification.createdAt} className="text-xs text-muted">
              {new Date(notification.createdAt).toLocaleString("pt-BR")}
            </time>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">
              {notification.reason}
            </p>
            <PreviousConversation missionId={notification.missionId} />
          </li>
        ))}
      </ul>
    </section>
  );
}
