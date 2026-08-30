import { ELECTORAL_CYCLE_END } from "@oficina/domain/electoral-ranking";
import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { ElectoralAwards } from "@/components/electoral-awards";
import { getElectoralRanking } from "@/lib/electoral-ranking-db";
import { requireSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Ranking — Oficina Amarela" };

export const dynamic = "force-dynamic";

function daysUntilCycleEnd() {
  const ms = ELECTORAL_CYCLE_END.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export default async function RankingPage() {
  const session = await requireSession();
  const ranking = await getElectoralRanking();

  const ordered = ranking.items;
  const daysLeft = daysUntilCycleEnd();
  const isFinished = daysLeft === 0;
  const activeCount = ranking.activeEditors;
  const milestone = ranking.highestActiveCount;
  const myRankIdx = ordered.findIndex((e) => e.id === session.id);

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 lg:px-8 lg:py-10">
          {/* ---- cabeçalho do ciclo ---- */}
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-text lg:text-2xl">
              Ranking eleitoral
            </h1>
            <span
              className={`flex-none rounded-full border px-2.5 py-1 text-xs font-medium ${
                isFinished
                  ? "border-line text-muted-2"
                  : "border-gold-lo/50 bg-gold/[0.07] text-gold-hi"
              }`}
            >
              {isFinished
                ? "ciclo encerrado"
                : daysLeft === 1
                  ? "1 dia restante"
                  : `${daysLeft} dias restantes`}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Conta vídeos aprovados até{" "}
            <b className="font-medium text-muted">25 de outubro de 2026</b>.
          </p>

          {/* ---- a guilda: quantos ativos agora e o recorde ---- */}
          <div className="mt-5 flex items-stretch gap-2">
            <div className="flex-1 rounded-lg border border-line-soft bg-white/[0.02] px-3 py-2.5">
              <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-gold-hi">
                {activeCount}
              </p>
              <p className="mt-0.5 text-[10px] uppercase leading-tight tracking-[0.04em] text-muted-2">
                editores ativos
                <br />
                esta semana
              </p>
            </div>
            <div className="flex-1 rounded-lg border border-line-soft bg-white/[0.02] px-3 py-2.5">
              <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text">
                {milestone}
              </p>
              <p className="mt-0.5 text-[10px] uppercase leading-tight tracking-[0.04em] text-muted-2">
                maior marca
                <br />
                do ciclo
              </p>
            </div>
            <div className="flex-1 rounded-lg border border-line-soft bg-white/[0.02] px-3 py-2.5">
              <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text">
                {myRankIdx === -1 ? "—" : `${myRankIdx + 1}º`}
              </p>
              <p className="mt-0.5 text-[10px] uppercase leading-tight tracking-[0.04em] text-muted-2">
                sua
                <br />
                posição
              </p>
            </div>
          </div>

          {/* ---- prêmios: o que a guilda já abriu e o que falta ---- */}
          <section className="mt-6">
            <div className="mb-2.5 flex items-baseline justify-between gap-3">
              <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-gold">
                Prêmios do ciclo
              </h2>
              <span className="text-[11px] text-muted-2">
                {ranking.awards.length} de 4 liberados
              </span>
            </div>
            <ElectoralAwards unlockedAwards={ranking.awards} highestActiveCount={milestone} />
            <p className="mt-2 text-[11px] leading-relaxed text-muted-2">
              Os prêmios se abrem conforme a guilda cresce — quanto mais editores ativos, mais gente
              premiada no fim.
            </p>
          </section>

          {/* ---- a fila ---- */}
          <section className="mt-7">
            <h2 className="mb-2.5 text-xs font-medium uppercase tracking-[0.14em] text-gold">
              Classificação
            </h2>

            {ordered.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line p-10 text-center">
                <p className="text-sm text-muted">
                  Ninguém no ranking ainda. Ele se preenche conforme os editores completam o perfil
                  e entregam.
                </p>
                <Link
                  href="/editor"
                  className="mt-2 inline-flex min-h-11 items-center px-2 text-sm font-medium text-gold-hi hover:underline"
                >
                  Ir pra fila de missões
                </Link>
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-lg border border-line-soft">
                  <div className="flex items-center gap-2 bg-white/[0.02] px-3 py-2 text-[10px] uppercase tracking-[0.06em] text-muted-2">
                    <span className="w-5">#</span>
                    <span className="flex-1">editor</span>
                    <span>aprovados</span>
                  </div>

                  {ordered.map((e, i) => {
                    const eu = e.id === session.id;
                    const pos = i + 1;
                    const level =
                      pos === 1
                        ? "ouro"
                        : pos === 2
                          ? "prata"
                          : pos === 3
                            ? "bronze"
                            : eu
                              ? "voce"
                              : "normal";
                    return (
                      <div
                        key={String(e.id)}
                        className={`linha-ranking relative flex items-center gap-2 border-t border-line-soft px-3 py-2.5 ${
                          level === "ouro"
                            ? "linha-ouro bg-gradient-to-r from-gold/[0.16] via-gold/[0.05] to-transparent"
                            : level === "prata"
                              ? "bg-gradient-to-r from-silver/[0.11] to-transparent"
                              : level === "bronze"
                                ? "bg-gradient-to-r from-bronze/[0.1] to-transparent"
                                : level === "voce"
                                  ? "bg-gold/[0.045]"
                                  : ""
                        }`}
                      >
                        <span
                          className={`w-5 font-[family-name:var(--font-display)] text-sm font-semibold ${
                            level === "ouro"
                              ? "text-gold-hi"
                              : level === "prata"
                                ? "text-silver-hi"
                                : level === "bronze"
                                  ? "text-bronze-hi"
                                  : level === "voce"
                                    ? "text-gold-hi/80"
                                    : "text-muted-2"
                          }`}
                        >
                          {pos}
                        </span>

                        <span className="flex-1 truncate text-sm text-text">
                          {eu ? "Você" : `@${String(e.apelido ?? e.handle)}`}
                        </span>

                        <span
                          className={`font-[family-name:var(--font-display)] text-sm font-semibold ${
                            level === "ouro"
                              ? "text-gold-hi"
                              : level === "prata"
                                ? "text-silver-hi"
                                : level === "bronze"
                                  ? "text-bronze-hi"
                                  : level === "voce"
                                    ? "text-gold-hi/80"
                                    : "text-muted"
                          }`}
                        >
                          {Number(e.quantidade ?? e.count)}
                        </span>
                      </div>
                    );
                  })}

                  <style>{`
                    .linha-ranking { overflow: hidden; }
                    .linha-ouro { animation: linha-ouro-pulso 3.2s ease-in-out infinite; }
                    .linha-ouro::after {
                      content: "";
                      position: absolute;
                      inset: -60% -20%;
                      background: linear-gradient(75deg, transparent 42%, rgba(255,255,255,0.14) 50%, transparent 58%);
                      transform: translateX(-140%);
                      animation: linha-ouro-varredura 4.8s ease-in-out infinite;
                      pointer-events: none;
                    }
                    @keyframes linha-ouro-pulso {
                      0%, 100% { box-shadow: inset 0 0 0 1px rgba(244,206,31,0.22), 0 0 16px rgba(244,206,31,0.1); }
                      50% { box-shadow: inset 0 0 0 1px rgba(244,206,31,0.4), 0 0 22px rgba(244,206,31,0.2); }
                    }
                    @keyframes linha-ouro-varredura {
                      0%, 15% { transform: translateX(-140%); }
                      55%, 100% { transform: translateX(140%); }
                    }
                    @media (prefers-reduced-motion: reduce) {
                      .linha-ouro { animation: none; box-shadow: inset 0 0 0 1px rgba(244,206,31,0.3); }
                      .linha-ouro::after { animation: none; display: none; }
                    }
                  `}</style>
                </div>

                <p className="mt-2 text-[11px] text-muted-2">
                  Em caso de empate, fica na frente quem alcançou o número primeiro.
                </p>
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
