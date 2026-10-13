"use client";

import { MISSION_NOTIFICATION_LABELS } from "@oficina/domain/mission-notifications";
import { useEffect, useState } from "react";

export function MissionNotifications({ missionId }: { missionId?: string }) {
  const [events, setEvents] = useState<
    {
      key: string;
      missionTitle?: string;
      event: string;
      version: number;
      notes: string | null;
      createdAt: string;
    }[]
  >([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(
      `/api/profile/notifications${missionId ? `?missionId=${encodeURIComponent(missionId.replace(/^db-/, ""))}` : ""}`,
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("notifications_unavailable");
        return response.json();
      })
      .then((data) => {
        if (active) {
          setEvents(data);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [missionId]);
  if (!events.length && !error) return null;
  return (
    <section className="mt-5" aria-label="Notificações da missão">
      <h2 className="text-sm font-semibold">Notificações da missão</h2>
      {error ? (
        <p role="status">Não foi possível carregar os avisos. Atualize a página.</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm text-muted">
          {events.map((event) => (
            <li key={event.key}>
              {!missionId && event.missionTitle && (
                <p className="font-medium text-text">{event.missionTitle}</p>
              )}
              <p>
                {MISSION_NOTIFICATION_LABELS[event.event] ?? "Atualização da missão"}
                {event.version > 0 ? ` · versão ${event.version}` : ""}
              </p>
              {event.notes && <p className="whitespace-pre-line">{event.notes}</p>}
              <time dateTime={event.createdAt}>
                {new Date(event.createdAt).toLocaleString("pt-BR")}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
