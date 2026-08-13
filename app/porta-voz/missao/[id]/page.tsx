import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pautaPorIdDoPortaVoz, posicaoNaFila, totalNaFila } from "@/lib/pautas-db";
import { lerCandidatoProprio } from "@/lib/candidato-db";
import { exigirSessao } from "@/lib/sessao-servidor";
import { pareceLinkDrive } from "@/lib/validators";
import {
  ETAPAS_MISSAO,
  ROTULO_FORMATO,
  ROTULO_STATUS,
  etapaAtual,
  mensagemStatusPortaVoz,
} from "@/lib/pautas";
import { AcoesMissao } from "@/components/acoes-missao";
import { AvatarCandidato } from "@/components/avatar-candidato";

export const metadata: Metadata = { title: "Missão — Oficina Amarela" };
export const dynamic = "force-dynamic";

function formatarData(iso: string, comAno = true) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    ...(comAno ? { year: "numeric" } : {}),
  });
}

// prazo desejado é data pura ("AAAA-MM-DD"), sem hora. Precisa ser lida em
// UTC: no fuso do Brasil, a meia-noite UTC cai no dia anterior.
function formatarDataPura(ymd: string) {
  return new Date(ymd).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "há 2 dias" — a data crua não responde "faz muito tempo?", que é a
 *  pergunta real de quem está esperando o vídeo.
 *
 *  Conta dias de CALENDÁRIO, não tempo decorrido: algo criado às 23h de
 *  ontem faz poucas horas, mas dizer "hoje" ao lado da data de ontem soa
 *  errado pra quem lê. */
function tempoDesde(iso: string) {
  const meiaNoite = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((meiaNoite(new Date()) - meiaNoite(new Date(iso))) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "há 1 mês" : `há ${meses} meses`;
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

  const [pauta, posicao, total, candidato] = await Promise.all([
    pautaPorIdDoPortaVoz(idNum, sessao.id),
    posicaoNaFila(idNum),
    totalNaFila(),
    lerCandidatoProprio(sessao.id),
  ]);
  if (!pauta) notFound();

  const msg = mensagemStatusPortaVoz(pauta.status);
  const etapa = etapaAtual(pauta.status);

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
              criada {tempoDesde(pauta.criadaEm)} · {formatarData(pauta.criadaEm)}
            </span>
          </div>

          {/* posição na fila — só faz sentido enquanto ninguém pegou. É a
              pergunta que o porta-voz mais faz: "falta muito?" */}
          {pauta.status === "disponivel" && posicao > 0 && (
            <p className="mt-3 text-xs text-muted">
              Posição <b className="text-text">{posicao}</b> de {total} na fila
              dos editores
            </p>
          )}

          {/* linha do tempo do ciclo — dá a sensação de acompanhamento que a
              tela não tinha. Deriva só do status, sem consulta extra. */}
          <ol className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-[11px]">
            {ETAPAS_MISSAO.map((nome, i) => {
              const vencida = i < etapa;
              const atual = i === etapa;
              return (
                <li key={nome} className="flex items-center gap-2">
                  <span
                    className={
                      atual
                        ? "rounded-full border border-gold-lo/60 bg-gold/10 px-2.5 py-0.5 font-medium text-gold-hi"
                        : vencida
                          ? "text-gold-lo"
                          : "text-muted-2"
                    }
                  >
                    {vencida && !atual ? "✓ " : ""}
                    {nome}
                  </span>
                  {i < ETAPAS_MISSAO.length - 1 && (
                    <span aria-hidden="true" className="text-line">
                      →
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </header>

      {/* aceitar ou pedir ajuste — o inspetor já liberou, falta o porta-voz */}
      {pauta.status === "aprovada" && <AcoesMissao id={pauta.id} />}

      {/* card do porta-voz — quem criou essa missão */}
      {candidato && (
        <section className="mb-8 flex items-center gap-4 rounded-2xl border border-line bg-surface/60 p-5">
          <AvatarCandidato
            candidato={candidato}
            className="h-14 w-14 text-lg"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text">
              {candidato.nome}
            </p>
            {candidato.local && (
              <p className="mt-0.5 text-xs text-muted">{candidato.local}</p>
            )}
          </div>
        </section>
      )}

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
              Prazo do editor até {formatarData(pauta.reservadaAte, false)}
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
      {pauta.driveLink && pareceLinkDrive(pauta.driveLink) && (
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

      {/* brief — tudo que o porta-voz pediu no wizard. Mostra todos os campos
          sempre, mesmo vazios: o editor (e o próprio dono) precisa saber o
          que foi preenchido e o que ficou de fora. */}
      <section className="mb-6">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-gold">
          Briefing (como você pediu)
        </h2>
        <dl className="grid gap-3 rounded-2xl border border-line bg-surface/40 p-5 sm:grid-cols-2">
          {(
            [
              ["Prazo desejado", pauta.prazoDesejado ? formatarDataPura(pauta.prazoDesejado) : undefined],
              ["Tom", pauta.brief.tom],
              ["Cor", pauta.brief.cor],
              ["Fonte / legenda", pauta.brief.fonte],
            ] as const
          ).map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt className="text-[11px] uppercase tracking-wide text-muted-2">
                {rotulo}
              </dt>
              <dd className={valor ? "mt-0.5 text-sm text-text" : "mt-0.5 text-sm text-muted-2 italic"}>
                {valor ?? "não informado"}
              </dd>
            </div>
          ))}
          {(
            [
              ["Referências", pauta.brief.refs],
              ["Cortes específicos", pauta.extras],
              ["Por que esse vídeo importa", pauta.motivo],
            ] as const
          ).map(([rotulo, valor]) => (
            <div key={rotulo} className="sm:col-span-2">
              <dt className="text-[11px] uppercase tracking-wide text-muted-2">
                {rotulo}
              </dt>
              <dd className={`mt-0.5 text-sm ${valor ? "whitespace-pre-line text-text" : "text-muted-2 italic"}`}>
                {valor ?? "não informado"}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* observação da reedição — o texto muda conforme quem pediu */}
      {pauta.notasInspetor && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-gold">
            {pauta.reedicaoPedidaPor === "porta_voz"
              ? "O ajuste que você pediu"
              : "Observação do controle de qualidade"}
          </h2>
          <p className="rounded-2xl border border-line bg-surface/40 p-5 text-sm leading-relaxed text-muted">
            {pauta.notasInspetor}
          </p>
        </section>
      )}
    </div>
  );
}
