"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ROTULO_FORMATO, type Pauta } from "@/lib/pautas";
import { pareceLinkDrive, pareceLinkYoutube } from "@/lib/validators";

type Oferta = { pauta: Pauta; expiraEm: string; ordem: number };

const INTERVALO_POLL_MS = 15_000;

function Chip({ k, v }: { k: string; v: string }) {
  return (
    <span className="rounded-md border border-line-soft bg-surface px-2 py-0.5 text-[11px] text-muted">
      <span className="text-muted-2">{k}:</span> {v}
    </span>
  );
}

/**
 * O dispatch do lado do editor.
 * Agora o editor controla explicitamente se está na fila ou não.
 */
export function OfertaMissao({ temMissaoEmMaos }: { temMissaoEmMaos: boolean }) {
  const router = useRouter();
  const [isNaFila, setIsNaFila] = useState(false);
  const [oferta, setOferta] = useState<Oferta | null>(null);
  const [processando, setProcessando] = useState(false);
  const [aviso, setAviso] = useState("");
  const buscando = useRef(false);
  const ultimoId = useRef<string | null>(null);

  const buscar = useCallback(async () => {
    if (buscando.current) return;
    buscando.current = true;
    try {
      const resp = await fetch("/api/editor/fila/proxima");
      const nova: Oferta | null =
        resp.status === 204 ? null : resp.ok ? await resp.json() : undefined!;
      if (nova === undefined) return; // erro: mantém o que está na tela

      setOferta(nova);

      const idAtual = nova?.pauta.id ?? null;
      if (idAtual !== ultimoId.current) {
        ultimoId.current = idAtual;
        router.refresh();
      }
    } catch {
      // rede caiu: tenta de novo no próximo ciclo
    } finally {
      buscando.current = false;
    }
  }, [router]);

  useEffect(() => {
    if (temMissaoEmMaos || !isNaFila) return;
    const inicial = setTimeout(buscar, 0);
    const t = setInterval(buscar, INTERVALO_POLL_MS);
    return () => {
      clearTimeout(inicial);
      clearInterval(t);
    };
  }, [buscar, temMissaoEmMaos, isNaFila]);

  async function responder(acao: "aceitar" | "recusar") {
    if (!oferta) return;
    setAviso("");
    setProcessando(true);

    const resp = await fetch("/api/editor/fila/proxima", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pautaId: oferta.pauta.id, acao }),
    });

    setProcessando(false);
    setOferta(null);
    ultimoId.current = null;

    if (!resp.ok) {
      const dados = await resp.json().catch(() => null);
      setAviso(dados?.erro ?? "Não deu pra responder. Tenta de novo.");
      buscar();
      return;
    }

    if (acao === "aceitar") router.refresh();
    else buscar();
  }

  function sairDaFila() {
    setIsNaFila(false);
    if (oferta) {
      setOferta(null);
      ultimoId.current = null;
      // recusa silenciosamente para liberar a missão
      fetch("/api/editor/fila/proxima", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pautaId: oferta.pauta.id, acao: "recusar" }),
      }).catch(() => {});
    }
  }

  if (temMissaoEmMaos) return null;

  if (!isNaFila) {
    return (
      <section className="mb-8 rounded-2xl border border-line bg-surface/40 px-6 py-10 text-center">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
          Você está fora da fila
        </h2>
        <p className="mx-auto mt-2 mb-6 max-w-sm text-sm text-muted">
          Clique abaixo quando estiver pronto para receber missões. Sem pressa e sem cronômetro.
        </p>
        <button className="btn-gold mx-auto px-8" onClick={() => setIsNaFila(true)}>
          ▶ Entrar na fila
        </button>
      </section>
    );
  }

  if (!oferta) {
    return (
      <section className="mb-8 rounded-2xl border border-line bg-surface/40 px-6 py-10 text-center relative">
        <button
          onClick={sairDaFila}
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

  const p = oferta.pauta;
  const temBrief = p.brief.tom || p.brief.cor || p.brief.fonte || p.brief.refs;

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-gold-lo/60 bg-gradient-to-b from-gold/[0.09] to-transparent relative">
      <button
        onClick={sairDaFila}
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
          {p.titulo}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {p.portaVoz} · {ROTULO_FORMATO[p.formato]}
        </p>

        {temBrief && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {p.brief.tom && <Chip k="tom" v={p.brief.tom} />}
            {p.brief.cor && <Chip k="cor" v={p.brief.cor} />}
            {p.brief.fonte && <Chip k="fonte" v={p.brief.fonte} />}
            {p.brief.refs && <Chip k="ref" v={p.brief.refs} />}
          </div>
        )}

        {(p.extras || p.motivo) && (
          <div className="mt-4 flex flex-col gap-2 text-xs">
            {p.extras && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-2">
                  Cortes pedidos
                </p>
                <p className="mt-0.5 whitespace-pre-line text-muted">{p.extras}</p>
              </div>
            )}
            {p.motivo && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-2">
                  Contexto
                </p>
                <p className="mt-0.5 whitespace-pre-line text-muted">{p.motivo}</p>
              </div>
            )}
          </div>
        )}

        {aviso && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {aviso}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row" data-guia="aceitar-missao">
          <button
            className="btn-gold sm:flex-[1.4]"
            onClick={() => responder("aceitar")}
            disabled={processando}
          >
            {processando ? "…" : "Aceitar missão"}
          </button>
          <button
            className="btn-ghost sm:flex-1"
            onClick={() => responder("recusar")}
            disabled={processando}
          >
            Passar
          </button>
          {p.driveLink && pareceLinkDrive(p.driveLink) && (
            <a
              href={p.driveLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost grid place-items-center sm:w-36"
            >
              Ver o bruto
            </a>
          )}
          {p.youtubeLink && pareceLinkYoutube(p.youtubeLink) && (
            <a
              href={p.youtubeLink}
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
