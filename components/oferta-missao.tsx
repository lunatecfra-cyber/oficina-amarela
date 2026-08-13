"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ROTULO_FORMATO, type Pauta } from "@/lib/pautas";
import { pareceLinkDrive } from "@/lib/validators";

type Oferta = { pauta: Pauta; expiraEm: string; ordem: number };

const INTERVALO_POLL_MS = 15_000;

function Chip({ k, v }: { k: string; v: string }) {
  return (
    <span className="rounded-md border border-line-soft bg-surface px-2 py-0.5 text-[11px] text-muted">
      <span className="text-muted-2">{k}:</span> {v}
    </span>
  );
}

function contagem(ms: number) {
  if (ms <= 0) return "0:00";
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * O dispatch do lado do editor.
 *
 * Fica no topo da fila e pergunta ao servidor de tempos em tempos se tem
 * missão pra ele. O próprio polling é o sinal de presença: parar de chamar
 * é o mesmo que ficar offline, e o servidor deixa de oferecer.
 *
 * O contador roda a cada segundo só na tela; quem decide se a oferta ainda
 * vale é sempre o banco (`expira_em > now()`), pra relógio adiantado do
 * cliente não conseguir aceitar oferta vencida.
 */
export function OfertaMissao({ temMissaoEmMaos }: { temMissaoEmMaos: boolean }) {
  const router = useRouter();
  const [oferta, setOferta] = useState<Oferta | null>(null);
  const [agora, setAgora] = useState<number | null>(null);
  const [processando, setProcessando] = useState(false);
  const [aviso, setAviso] = useState("");
  // evita duas chamadas se a rede demorar mais que o intervalo
  const buscando = useRef(false);
  // qual missão estava na mão no ciclo anterior, pra saber quando mudou
  const ultimoId = useRef<string | null>(null);
  // quando o editor entrou em espera — só existe no cliente, senão o
  // servidor mandaria um horário diferente e quebraria a hidratação
  const [esperandoDesde, setEsperandoDesde] = useState<number | null>(null);

  const buscar = useCallback(async () => {
    if (buscando.current) return;
    buscando.current = true;
    try {
      const resp = await fetch("/api/editor/fila/proxima");
      const nova: Oferta | null =
        resp.status === 204 ? null : resp.ok ? await resp.json() : undefined!;
      if (nova === undefined) return; // erro: mantém o que está na tela

      setOferta(nova);

      // A lista aberta é renderizada no servidor, antes deste polling rodar.
      // Sem isto, a missão recém-oferecida aparecia DUAS vezes: no card de
      // oferta e na lista, com um "Reservar" que já não funcionava.
      // Só recarrega quando a oferta muda de fato — não a cada ciclo.
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

  // com missão em mãos o editor não recebe oferta — não faz sentido bater
  // no servidor a cada 15s só pra ouvir "nada".
  //
  // A primeira busca vai num setTimeout(0) em vez de direto: assim o
  // setState dela não acontece dentro do commit do efeito (que é o que
  // dispara render em cascata). O atraso é de um tick, imperceptível.
  useEffect(() => {
    if (temMissaoEmMaos) return;
    const inicial = setTimeout(buscar, 0);
    const t = setInterval(buscar, INTERVALO_POLL_MS);
    return () => {
      clearTimeout(inicial);
      clearInterval(t);
    };
  }, [buscar, temMissaoEmMaos]);

  // o relógio só existe no cliente: ler Date.now() na renderização do
  // servidor daria um valor diferente e quebraria a hidratação
  useEffect(() => {
    const tick = () => setAgora(Date.now());
    const inicial = setTimeout(tick, 0);
    // com oferta na mão o contador precisa correr de segundo em segundo;
    // esperando, de minuto em minuto já basta
    const t = setInterval(tick, oferta ? 1000 : 30_000);
    return () => {
      clearTimeout(inicial);
      clearInterval(t);
    };
  }, [oferta]);

  // reinicia o cronômetro de espera toda vez que ele volta a ficar sem
  // oferta. O setTimeout(0) tira o setState de dentro do commit do efeito,
  // que é o que dispararia render em cascata.
  useEffect(() => {
    const emEspera = !oferta && !temMissaoEmMaos;
    const t = setTimeout(() => setEsperandoDesde(emEspera ? Date.now() : null), 0);
    return () => clearTimeout(t);
  }, [oferta, temMissaoEmMaos]);

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

    // aceitou: a página inteira muda (a missão vira "em mãos"), então
    // recarrega. Passou: só busca a próxima, que já recarrega se vier algo.
    if (acao === "aceitar") router.refresh();
    else buscar();
  }

  if (temMissaoEmMaos) return null;

  const esperandoHa =
    agora === null || esperandoDesde === null
      ? null
      : Math.floor((agora - esperandoDesde) / 60_000);

  if (!oferta) {
    return (
      <section className="mb-8 rounded-2xl border border-line bg-surface/40 px-6 py-10 text-center">
        <span className="relative mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-gold-lo/40 bg-gold/[0.06] text-2xl">
          {/* o halo pulsando é o único sinal de que o sistema está vivo:
              sem ele a tela parada parece travada */}
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-ping rounded-2xl border border-gold-lo/30"
            style={{ animationDuration: "2.6s" }}
          />
          <span className="relative">🐆</span>
        </span>

        <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-text">
          A bancada está pronta
        </p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
          Assim que entrar uma missão com a sua cara, ela aparece aqui. Pode
          deixar essa aba aberta.
        </p>

        <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-line bg-ink-2 px-3 py-1 text-xs text-muted-2">
          <span className="h-2 w-2 rounded-full bg-ok" />
          Online
          {esperandoHa !== null && esperandoHa > 0 && (
            <>
              <span aria-hidden="true">·</span>
              esperando há {esperandoHa} min
            </>
          )}
        </p>
      </section>
    );
  }

  const restanteMs = agora === null ? null : new Date(oferta.expiraEm).getTime() - agora;
  const apertado = restanteMs !== null && restanteMs < 60_000;
  const p = oferta.pauta;
  const temBrief = p.brief.tom || p.brief.cor || p.brief.fonte || p.brief.refs;

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-gold-lo/60 bg-gradient-to-b from-gold/[0.09] to-transparent">
      <div
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(244,206,31,0.6), rgba(244,206,31,0.9), rgba(244,206,31,0.6), transparent)",
        }}
        aria-hidden="true"
      />
      <div className="p-6 lg:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs uppercase tracking-[0.15em] text-gold-hi">
            🎬 Nova missão pra você
          </span>
          <span
            aria-live="polite"
            className={`text-sm font-medium tabular-nums ${
              apertado ? "text-danger" : "text-muted"
            }`}
          >
            ⏳ expira em {restanteMs === null ? "—" : contagem(restanteMs)}
          </span>
        </div>

        <h2 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
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

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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
        </div>
      </div>
    </section>
  );
}
