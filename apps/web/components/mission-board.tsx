"use client";
import type { BoardMission } from "@oficina/domain/mission-board";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function MissionBoard() {
  const router = useRouter();
  const [data, setData] = useState<{ eligible: boolean; missions: BoardMission[] } | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/missions/board", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar o mural.");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar o mural.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function interest(id: number) {
    setBusy(id);
    setError("");
    try {
      const response = await fetch(`/api/missions/${id}/interest`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await load();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível registrar seu interesse.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="mt-6" aria-labelledby="board-title">
      <h2 id="board-title" className="text-xl font-semibold text-text">
        Mural de missões gratuitas
      </h2>
      <p className="mt-1 text-sm text-muted">
        Registre seu interesse. O porta-voz escolhe um editor e envia uma oferta; só o aceite inicia
        a produção.
      </p>
      {error && (
        <div role="alert" className="mt-3 text-sm text-danger">
          {error}{" "}
          <button className="underline" onClick={() => void load()}>
            Tentar novamente
          </button>
        </div>
      )}
      {!data && !error && (
        <p role="status" className="mt-3 text-muted">
          Carregando missões…
        </p>
      )}
      {data && !data.eligible && (
        <p className="mt-3 text-sm text-muted">
          Para novos interesses, complete seu perfil, fique disponível e conclua sua missão ou
          oferta atual.
        </p>
      )}
      {data?.missions.length === 0 && (
        <p className="mt-4 rounded-xl border border-line p-4 text-muted">
          Nenhuma missão disponível. Volte mais tarde.
        </p>
      )}
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {data?.missions.map((m) => (
          <li key={m.id} className="min-w-0 rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs text-muted">
              {m.spokesperson} · {m.format === "short" ? "Vídeo curto" : "Vídeo longo"}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-text">{m.title}</h3>
            <p className="mt-2 text-sm text-muted">
              Prazo desejado:{" "}
              {m.desiredDeadline
                ? new Date(`${m.desiredDeadline}T12:00:00Z`).toLocaleDateString("pt-BR", {
                    timeZone: "UTC",
                  })
                : "não informado"}
            </p>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-gold-hi">Conferir briefing</summary>
              <div className="mt-2 whitespace-pre-wrap break-words text-muted">
                {[m.motivation, m.extras, m.tone, m.refs].filter(Boolean).join("\n") ||
                  "Briefing sem observações adicionais."}
                <p className="mt-2">
                  Materiais privados são liberados na oferta ao editor selecionado.
                </p>
              </div>
            </details>
            <p className="mt-3 text-sm text-gold-hi" role="status">
              {m.assignedToMe
                ? "Atribuída a você — continue na bancada"
                : m.offerStatus === "pendente"
                  ? "Você foi selecionado — confira a oferta na bancada"
                  : m.offerStatus === "rejeitada"
                    ? "Você recusou esta oferta"
                    : m.offerStatus === "expirada"
                      ? "Sua oferta expirou"
                      : m.status !== "disponivel"
                        ? "Missão indisponível para novos interesses"
                        : m.interested
                          ? "Interesse registrado — aguardando escolha do porta-voz"
                          : "Aberta a interessados"}
            </p>
            {data.eligible && m.status === "disponivel" && !m.interested && !m.offerStatus && (
              <button
                className="btn-gold mt-3 w-full"
                disabled={busy !== null}
                onClick={() => void interest(m.id)}
              >
                {busy === m.id ? "Registrando…" : "Tenho interesse"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
