"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FORMAT_LABEL, type Mission } from "@/lib/missions";
import { looksLikeDriveLink, looksLikeYoutubeLink } from "@/lib/validators";

type Offer = { mission?: Mission; pauta?: Mission; expiresAt?: string; expiraEm?: string; order?: number; ordem?: number };

const POLL_INTERVAL_MS = 15_000;

function Chip({ k, v }: { k: string; v: string }) {
  return (
    <span className="rounded-md border border-line-soft bg-surface px-2 py-0.5 text-[11px] text-muted">
      <span className="text-muted-2">{k}:</span> {v}
    </span>
  );
}

export function MissionOffer({
  hasActiveMission,
  temMissaoEmMaos,
}: {
  hasActiveMission?: boolean;
  temMissaoEmMaos?: boolean;
}) {
  const router = useRouter();
  const [isInQueue, setIsInQueue] = useState(false);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notice, setNotice] = useState("");
  const isFetching = useRef(false);
  const lastId = useRef<string | null>(null);

  const activeMission = hasActiveMission ?? temMissaoEmMaos ?? false;

  const fetchNext = useCallback(async () => {
    if (isFetching.current) return;
    isFetching.current = true;
    try {
      const resp = await fetch("/api/editor/queue/next");
      const nextOffer: Offer | null =
        resp.status === 204 ? null : resp.ok ? await resp.json() : undefined!;
      if (nextOffer === undefined) return;

      setOffer(nextOffer);

      const m = nextOffer?.mission ?? (nextOffer as any)?.pauta;
      const currentId = m?.id ?? null;
      if (currentId !== lastId.current) {
        lastId.current = currentId;
        router.refresh();
      }
    } catch {
      // network failure
    } finally {
      isFetching.current = false;
    }
  }, [router]);

  useEffect(() => {
    if (activeMission || !isInQueue) return;
    const initial = setTimeout(fetchNext, 0);
    const t = setInterval(fetchNext, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(t);
    };
  }, [fetchNext, activeMission, isInQueue]);

  async function respond(action: "accept" | "decline" | "aceitar" | "recusar") {
    if (!offer) return;
    setNotice("");
    setIsProcessing(true);

    const m = offer.mission ?? (offer as any).pauta;
    const normalizedAction = action === "aceitar" || action === "accept" ? "accept" : "decline";

    const resp = await fetch("/api/editor/queue/next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        missionId: m.id,
        pautaId: m.id,
        action: normalizedAction,
        acao: normalizedAction === "accept" ? "aceitar" : "recusar",
      }),
    });

    setIsProcessing(false);
    setOffer(null);
    lastId.current = null;

    if (!resp.ok) {
      const data = await resp.json().catch(() => null);
      setNotice(data?.error ?? data?.erro ?? "Não deu pra responder. Tenta de novo.");
      fetchNext();
      return;
    }

    if (normalizedAction === "accept") router.refresh();
    else fetchNext();
  }

  function leaveQueue() {
    setIsInQueue(false);
    if (offer) {
      const m = offer.mission ?? (offer as any).pauta;
      setOffer(null);
      lastId.current = null;
      fetch("/api/editor/queue/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missionId: m.id, pautaId: m.id, action: "decline", acao: "recusar" }),
      }).catch(() => {});
    }
  }

  if (activeMission) return null;

  if (!isInQueue) {
    return (
      <section className="mb-8 rounded-2xl border border-line bg-surface/40 px-6 py-10 text-center">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
          Você está fora da fila
        </h2>
        <p className="mx-auto mt-2 mb-6 max-w-sm text-sm text-muted">
          Clique abaixo quando estiver pronto para receber missões. Sem pressa e sem cronômetro.
        </p>
        <button className="btn-gold mx-auto px-8" onClick={() => setIsInQueue(true)}>
          ▶ Entrar na fila
        </button>
      </section>
    );
  }

  if (!offer) {
    return (
      <section className="mb-8 rounded-2xl border border-line bg-surface/40 px-6 py-10 text-center relative">
        <button
          onClick={leaveQueue}
          className="absolute top-4 right-4 text-xs font-medium text-muted hover:text-text"
        >
          ⏹ Sair da fila
        </button>
        <span className="relative mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-gold-lo/40 bg-gold/[0.06] text-2xl">
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-ping rounded-2xl border border-gold-lo/30"
            style={{ animationDuration: "2.6s" }}
          />
          <span className="relative">🐆</span>
        </span>

        <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-text">
          Buscando missões...
        </p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
          Assim que entrar uma missão com a sua cara, ela aparece aqui.
        </p>
        <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-line bg-ink-2 px-3 py-1 text-xs text-muted-2">
          <span className="h-2 w-2 rounded-full bg-ok" />
          Online
        </p>
      </section>
    );
  }

  const p = offer.mission ?? (offer as any).pauta;
  const title = p.title ?? (p as any).titulo;
  const spokesperson = p.spokesperson ?? (p as any).portaVoz;
  const format = p.format ?? (p as any).formato ?? "short";
  const tone = p.brief?.tone ?? p.brief?.tom;
  const color = p.brief?.color ?? p.brief?.cor;
  const font = p.brief?.font ?? p.brief?.fonte;
  const refs = p.brief?.refs;
  const extras = p.extras;
  const motivation = p.motivation ?? (p as any).motivo;
  const driveLink = p.driveLink;
  const youtubeLink = p.youtubeLink;

  const hasBrief = tone || color || font || refs;

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-gold-lo/60 bg-gradient-to-b from-gold/[0.09] to-transparent relative">
      <button
        onClick={leaveQueue}
        className="absolute top-6 right-6 text-xs font-medium text-muted hover:text-text z-10"
      >
        ⏹ Sair da fila
      </button>
      <div
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(244,206,31,0.6), rgba(244,206,31,0.9), rgba(244,206,31,0.6), transparent)",
        }}
        aria-hidden="true"
      />
      <div className="p-6 lg:p-7 relative">
        <div className="flex flex-wrap items-center justify-between gap-3 pr-24">
          <span className="text-xs uppercase tracking-[0.15em] text-gold-hi">
            🎬 Nova missão pra você
          </span>
        </div>

        <h2 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl pr-20">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {spokesperson} · {FORMAT_LABEL[format]}
        </p>

        {hasBrief && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {tone && <Chip k="tom" v={tone} />}
            {color && <Chip k="cor" v={color} />}
            {font && <Chip k="fonte" v={font} />}
            {refs && <Chip k="ref" v={refs} />}
          </div>
        )}

        {(extras || motivation) && (
          <div className="mt-4 flex flex-col gap-2 text-xs">
            {extras && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-2">
                  Cortes pedidos
                </p>
                <p className="mt-0.5 whitespace-pre-line text-muted">{extras}</p>
              </div>
            )}
            {motivation && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-2">
                  Contexto
                </p>
                <p className="mt-0.5 whitespace-pre-line text-muted">{motivation}</p>
              </div>
            )}
          </div>
        )}

        {notice && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {notice}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row" data-guia="aceitar-missao">
          <button
            className="btn-gold sm:flex-[1.4]"
            onClick={() => respond("accept")}
            disabled={isProcessing}
          >
            {isProcessing ? "…" : "Aceitar missão"}
          </button>
          <button
            className="btn-ghost sm:flex-1"
            onClick={() => respond("decline")}
            disabled={isProcessing}
          >
            Passar
          </button>
          {driveLink && looksLikeDriveLink(driveLink) && (
            <a
              href={driveLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost grid place-items-center sm:w-36"
            >
              Ver o bruto
            </a>
          )}
          {youtubeLink && looksLikeYoutubeLink(youtubeLink) && (
            <a
              href={youtubeLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost grid place-items-center sm:w-36"
            >
              Ver no YouTube
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

export { MissionOffer as OfertaMissao };
