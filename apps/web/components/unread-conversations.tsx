"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Unread = { missionId: number; title: string; unread: number };

const POLL_MS = 30_000;

/** Conversations with messages the person has not read yet; each item links to the conversation. */
/** `hrefTemplate` carries `{id}` in place of the mission number (Server Component props are serialized, functions are not). */
export function UnreadConversations({ hrefTemplate }: { hrefTemplate: string }) {
  const [items, setItems] = useState<Unread[]>([]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    async function load() {
      try {
        const resp = await fetch("/api/missions/unread", { cache: "no-store" });
        if (resp.ok) setItems(((await resp.json()) as { missions: Unread[] }).missions ?? []);
      } catch {
        // offline: keep what was already on screen
      }
    }
    function start() {
      void load();
      timer = setInterval(() => void load(), POLL_MS);
    }
    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }
    function onVisibility() {
      stop();
      if (document.visibilityState === "visible") start();
    }
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (items.length === 0) return null;
  return (
    <section
      aria-label="Conversas com mensagens novas"
      className="rounded-2xl border border-gold-lo/50 bg-gold/[0.06] p-4"
    >
      <h2 className="text-sm font-medium text-text">Conversas com novidades</h2>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.missionId}>
            <Link
              href={hrefTemplate.replace("{id}", String(item.missionId))}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm text-text hover:bg-gold/10"
            >
              <span className="truncate">{item.title}</span>
              <span className="flex-none rounded-full bg-gold px-2 py-px text-[11px] font-semibold text-ink">
                {item.unread} {item.unread === 1 ? "nova" : "novas"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
