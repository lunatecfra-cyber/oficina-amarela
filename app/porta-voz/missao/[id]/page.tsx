import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pautaPorIdDoPortaVoz } from "@/lib/pautas-db";
import { exigirSessao } from "@/lib/sessao-servidor";
import { ROTULO_FORMATO, ROTULO_STATUS } from "@/lib/pautas";

export const metadata: Metadata = { title: "Missão — Oficina Amarela" };
export const dynamic = "force-dynamic";

// mensagem de status do ponto de vista de quem espera o vídeo (mesma lógica do
// painel, replicada aqui pra tela de detalhe ser autossuficiente)
function mensagemStatus(status: string): { texto: string; cor: string } {
  switch (status) {
    case "reservada":
    case "em_revisao":
      return { texto: "🎬 Seu vídeo começou a ser feito", cor: "text-gold-hi" };
    case "reedicao":
      return { texto: "💬 O editor tem uma observação", cor: "text-silver-hi" };
    case "aprovada":
      return { texto: "✅ Seu vídeo está pronto!", cor: "text-ok" };
    default:
      return { texto: "Na fila dos editores", cor: "text-muted" };
  }
}

export default async function DetalheMissaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await exigirSessao();
  const { id: idBruto } = await params;

  // ids das pautas reais vêm como "db-123"; demos usam "p1" etc. e não têm
  // detalhe (são só estáticas). Só aceitamos reais aqui.
  const idNum = Number(String(idBruto).replace(/^db-/, ""));
  if (!Number.isInteger(idNum)) notFound();

  const pauta = await pautaPorIdDoPortaVoz(idNum, sessao.id);
  if (!pauta) notFound();

  const msg = mensagemStatus(pauta.status);
  const briefPreenchido =
    pauta.brief.tom || pauta.brief.cor || pauta.brief.fonte || pauta.brief.refs;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-8 lg:py-12">
      <div className="mb-6">
        <Link
          href="/porta-voz"
          className="text-sm text-muted transition-colors hover:text-silver-hi"
        >
          ← Minhas missões
        </Link>
      </div>

      {/* card de resumo — status + título + metadados agrupados numa caixa,
          em vez de soltos. Combina com os cards das seções de baixo (vídeo
          bruto, briefing) pra tela inteira ficar coesa. */}
      <header className="mb-8 overflow-hidden rounded-2xl border border-line bg-surface/60">
        {/* filete dourado no topo — identidade visual da marca */}
        <div
          className="h-1 w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(244,206,31,0.6), rgba(244,206,31,0.9), rgba(244,206,31,0.6), transparent)",
          }}
          aria-hidden="true"
        />
        <div className="p-5 lg:p-6">
          <p className={`text-sm font-medium ${msg.cor}`}>{msg.texto}</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
            {pauta.titulo}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-2">
            <span className="rounded-full border border-line bg-ink-2 px-2.5 py-0.5">
              {ROTULO_FORMATO[pauta.formato]}
            </span>
            <span>{ROTULO_STATUS[pauta.status]}</span>
            <span aria-hidden="true">·</span>
            <span>
              criada em{" "}
              {new Date(pauta.criadaEm).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      </header>

      {/* status / editor / entrega — só mostra o que existe */}
      {(pauta.reservadaPor || pauta.entregaLink) && (
        <section className="mb-8 rounded-2xl border border-line bg-surface/60 p-5">
          {pauta.reservadaPor && (
            <p className="text-sm text-muted">
              Editor responsável:{" "}
              <span className="font-medium text-text">{pauta.reservadaPor}</span>
            </p>
          )}
          {pauta.reservadaAte && (
            <p className="mt-1 text-xs text-muted-2">
              Prazo do editor até{" "}
              {new Date(pauta.reservadaAte).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              })}
            </p>
          )}
          {pauta.entregaLink && (
            <a
              href={pauta.entregaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold mt-3 inline-block w-auto px-5"
            >
              ▶ Ver vídeo entregue
            </a>
          )}
        </section>
      )}

      {/* material bruto */}
      {pauta.driveLink && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-gold">
            Vídeo bruto
          </h2>
          <a
            href={pauta.driveLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm text-gold-hi transition-colors hover:border-gold/40 hover:bg-surface-2"
          >
            📁 Abrir no Google Drive
          </a>
        </section>
      )}

      {/* brief — só mostra se o porta-voz preencheu algo */}
      {briefPreenchido && (
        <section className="mb-6">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-gold">
            Briefing (como você pediu)
          </h2>
          <dl className="grid gap-3 rounded-2xl border border-line bg-surface/40 p-5 sm:grid-cols-2">
            {pauta.brief.tom && (
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-2">Tom</dt>
                <dd className="mt-0.5 text-sm text-text">{pauta.brief.tom}</dd>
              </div>
            )}
            {pauta.brief.cor && (
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-2">Cor</dt>
                <dd className="mt-0.5 text-sm text-text">{pauta.brief.cor}</dd>
              </div>
            )}
            {pauta.brief.fonte && (
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-2">Fonte / legenda</dt>
                <dd className="mt-0.5 text-sm text-text">{pauta.brief.fonte}</dd>
              </div>
            )}
            {pauta.brief.refs && (
              <div className="sm:col-span-2">
                <dt className="text-[11px] uppercase tracking-wide text-muted-2">Referências</dt>
                <dd className="mt-0.5 text-sm text-text">{pauta.brief.refs}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* observação do inspetor/editor (reedição) */}
      {pauta.notasInspetor && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-gold">
            Observação do editor
          </h2>
          <p className="rounded-2xl border border-line bg-surface/40 p-5 text-sm leading-relaxed text-muted">
            {pauta.notasInspetor}
          </p>
        </section>
      )}
    </div>
  );
}
