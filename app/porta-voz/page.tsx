import type { Metadata } from "next";
import Link from "next/link";
import {
  PAUTAS,
  ROTULO_FORMATO,
  ROTULO_STATUS,
  mensagemStatusPortaVoz,
  type Pauta,
  type StatusPauta,
} from "@/lib/pautas";
import { pautasDisponiveis, pautasDoPortaVoz } from "@/lib/pautas-db";
import { lerSessao } from "@/lib/sessao-servidor";

// esta tela precisa refletir a pauta que acabou de ser criada, então não pode
// servir versão em cache
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Minhas Missões — Oficina Amarela" };

// ── helpers de data (mesmos da tela de detalhe) ───────────────────

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** "há 2 dias" — conta dias de calendário, não horas decorridas. */
function tempoDesde(iso: string) {
  const meiaNoite = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round(
    (meiaNoite(new Date()) - meiaNoite(new Date(iso))) / 86_400_000,
  );
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "há 1 mês" : `há ${meses} meses`;
}

// ── cor de destaque à esquerda por status ─────────────────────────

function corBordaStatus(status: StatusPauta): string {
  switch (status) {
    case "disponivel":
      return "border-l-muted"; // discreto — na fila
    case "reservada":
    case "minha":
      return "border-l-gold"; // em produção
    case "em_revisao":
      return "border-l-silver-hi"; // conferência
    case "reedicao":
      return "border-l-silver"; // ajuste pedido
    case "aprovada":
      return "border-l-ok"; // pronto
    case "finalizada":
      return "border-l-ok"; // concluída
    default:
      return "";
  }
}

// ── filete dourado (gradiente horizontal) ─────────────────────────

function FileteDourado() {
  return (
    <div
      aria-hidden="true"
      className="h-px rounded-full"
      style={{
        background:
          "linear-gradient(90deg, transparent 0%, rgba(244,206,31,0.7) 30%, rgba(244,206,31,0.9) 50%, rgba(244,206,31,0.7) 70%, transparent 100%)",
      }}
    />
  );
}

// ── badge pill (formato, status) ──────────────────────────────────

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-ink-2 px-2.5 py-0.5 text-[11px] font-medium text-muted-2">
      {children}
    </span>
  );
}

// ── card ──────────────────────────────────────────────────────────

// só missão real (id "db-N") tem tela de detalhe; as de demonstração são
// cards estáticos e não existem no banco
const ehReal = (id: string) => id.startsWith("db-");

/**
 * A casca do card. Existe porque as duas listas (na fila / em andamento)
 * precisavam do mesmo `<li>` e do mesmo "vira link se for real" — antes esse
 * bloco estava escrito duas vezes dentro do mesmo `map`.
 *
 * Importante: TODA missão real é clicável, inclusive as já entregues. É por
 * aqui que o porta-voz chega no vídeo pronto e nos botões de aceitar/ajustar.
 */
function CardMissao({
  pauta,
  children,
}: {
  pauta: Pauta;
  children: React.ReactNode;
}) {
  const real = ehReal(pauta.id);
  return (
    <li
      className={`overflow-hidden rounded-2xl border border-l-[3px] border-line bg-surface/60 ${
        corBordaStatus(pauta.status)
      } ${real ? "transition-colors hover:border-gold/40 hover:bg-surface-2" : ""}`}
    >
      {/* filete dourado só nos cards reais (clicáveis) */}
      {real && <FileteDourado />}
      <div className="p-4 lg:p-5">
        {real ? (
          <Link href={`/porta-voz/missao/${pauta.id}`} className="group block">
            {children}
          </Link>
        ) : (
          children
        )}
      </div>
    </li>
  );
}

// ── página ────────────────────────────────────────────────────────

export default async function PortaVozHome() {
  const sessao = await lerSessao();

  const MODO_DEMO = process.env.NODE_ENV !== "production";

  // pautas de verdade (banco) +, só em dev, as de demonstração para a tela
  // não ficar vazia numa conta nova
  const [reaisMinhas, reaisDisponiveis] = await Promise.all([
    sessao ? pautasDoPortaVoz(sessao.id) : Promise.resolve([]),
    pautasDisponiveis(),
  ]);

  const demoMinhas = MODO_DEMO ? PAUTAS.filter((p) => p.portaVoz === sessao?.nome) : [];
  const minhas = [...reaisMinhas, ...demoMinhas];

  // fila compartilhada: todas as pautas disponíveis (de todo mundo), ordenadas por criação
  const demoDisponiveis = MODO_DEMO ? PAUTAS.filter((p) => p.status === "disponivel") : [];
  const filaGeral = [
    ...reaisDisponiveis,
    ...demoDisponiveis,
  ].sort((a, b) => a.criadaEm.localeCompare(b.criadaEm));

  const naFila = minhas.filter((p) => p.status === "disponivel");
  const emAndamento = minhas.filter((p) => p.status !== "disponivel");

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-12">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
            Minhas missões
          </h1>
          <p className="mt-1 text-sm text-muted">
            Acompanhe o status de cada vídeo que você mandou pra guilda.
          </p>
        </div>
        <Link href="/porta-voz/nova-pauta" className="btn-gold w-auto px-6">
          + Nova missão
        </Link>
      </div>

      {/* estado vazio */}
      {minhas.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-line p-12 text-center">
          <p className="text-muted">Você ainda não criou nenhuma missão.</p>
          <Link
            href="/porta-voz/nova-pauta"
            className="mt-4 inline-block font-medium text-gold-hi hover:underline"
          >
            Criar a primeira
          </Link>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {/* ── Na fila ─────────────────────────────────────────── */}
          {naFila.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-gold">
                Na fila
              </h2>
              <ul className="flex flex-col gap-3">
                {naFila.map((p) => {
                  const idx = filaGeral.findIndex((f) => f.id === p.id);
                  const posicao = idx >= 0 ? idx + 1 : 0;
                  const total = filaGeral.length;
                  const real = ehReal(p.id);
                  return (
                    <CardMissao key={p.id} pauta={p}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text transition-colors group-hover:text-gold-hi">
                          {p.titulo}
                        </h3>
                        <Badge>{ROTULO_FORMATO[p.formato]}</Badge>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-2">
                        <span>
                          criada {tempoDesde(p.criadaEm)} · {formatarData(p.criadaEm)}
                        </span>
                        {posicao > 0 && (
                          <span>
                            Posição <b className="text-text">{posicao}</b> de {total}
                          </span>
                        )}
                      </div>
                      {!real && (
                        <span className="mt-2 inline-block rounded-full border border-line-soft bg-ink-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-2">
                          Demonstração
                        </span>
                      )}
                    </CardMissao>
                  );
                })}
              </ul>
            </section>
          )}

          {/* ── Em andamento e concluídas ──────────────────────── */}
          {emAndamento.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-gold">
                Em andamento e concluídas
              </h2>
              <ul className="flex flex-col gap-3">
                {emAndamento.map((p) => {
                  const msg = mensagemStatusPortaVoz(p.status);
                  const real = ehReal(p.id);
                  return (
                    <CardMissao key={p.id} pauta={p}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text transition-colors group-hover:text-gold-hi">
                            {p.titulo}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-2">
                            <Badge>{ROTULO_FORMATO[p.formato]}</Badge>
                            <span className="rounded-full border border-line bg-ink-2 px-2.5 py-0.5 text-[11px] font-medium text-muted-2">
                              {ROTULO_STATUS[p.status]}
                            </span>
                            <span>
                              criada {tempoDesde(p.criadaEm)} · {formatarData(p.criadaEm)}
                            </span>
                          </div>
                          {p.reservadaPor && (
                            <p className="mt-1 text-xs text-muted">
                              editor: {p.reservadaPor}
                            </p>
                          )}
                          {p.status === "reedicao" && p.notasInspetor && (
                            <p className="mt-1.5 text-xs italic text-muted-2">
                              &ldquo;{p.notasInspetor}&rdquo;
                            </p>
                          )}
                        </div>
                        {/* mensagem de status colorida */}
                        {msg.texto && (
                          <span
                            className={`mt-1 text-right text-sm font-medium sm:mt-0 ${msg.cor}`}
                          >
                            {msg.texto}
                          </span>
                        )}
                      </div>
                      {/* prazo desejado */}
                      {p.prazoDesejado && (
                        <p className="mt-2 text-xs text-muted-2">
                          ⏰ Prazo:{" "}
                          {new Date(p.prazoDesejado).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </p>
                      )}
                      {/* selo demo */}
                      {!real && (
                        <span className="mt-2 inline-block rounded-full border border-line-soft bg-ink-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-2">
                          Demonstração
                        </span>
                      )}
                    </CardMissao>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
