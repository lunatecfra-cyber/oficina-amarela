import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PAUTAS, ROTULO_STATUS } from "@/lib/pautas";
import { pautasDoPortaVoz } from "@/lib/pautas-db";
import { getCandidato } from "@/lib/candidatos";
import { lerCandidatoProprio } from "@/lib/candidato-db";
import { exigirSessao } from "@/lib/sessao-servidor";
import { Stat } from "@/components/stat";
import { Card } from "@/components/card";
import { AvatarCandidato } from "@/components/avatar-candidato";
import { DadosCandidato } from "@/components/dados-candidato";
import { NomeCandidato } from "@/components/nome-candidato";

export const metadata: Metadata = { title: "Meu Perfil — Oficina Amarela" };

// lê sessão (cookie + banco) e missões recentes — não pode ser estático
export const dynamic = "force-dynamic";

export default async function PerfilPortaVozPage() {
  const sessao = await exigirSessao();

  // perfil + missões de verdade (banco). PAUTAS só entra como demo quando o
  // nome bate com um candidato de demonstração — pra um porta-voz real nunca
  // casa, então as stats refletem só o que ele criou de fato.
  const [candOpt, reaisMinhas] = await Promise.all([
    lerCandidatoProprio(sessao.id),
    pautasDoPortaVoz(sessao.id),
  ]);
  const cand = candOpt ?? getCandidato(sessao.nome);
  const minhas = [...reaisMinhas, ...PAUTAS.filter((p) => p.portaVoz === sessao.nome)];

  // Os quatro contadores têm que somar o total, senão missão some da conta.
  // 'oferecida' (dispatch, ainda sem editor) conta como fila; 'finalizada'
  // (o porta-voz aceitou) conta como pronta — sem isso o número de aprovadas
  // DIMINUÍA no momento em que ele aceitava o vídeo.
  const naFila = minhas.filter((p) =>
    ["disponivel", "oferecida"].includes(p.status)
  ).length;
  const emProducao = minhas.filter((p) =>
    ["reservada", "em_revisao", "reedicao"].includes(p.status)
  ).length;
  const prontas = minhas.filter((p) =>
    ["aprovada", "finalizada"].includes(p.status)
  ).length;

  const historico = minhas.filter((p) =>
    ["aprovada", "finalizada", "reedicao"].includes(p.status)
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 lg:px-8 lg:py-10">
      {/* ---- cartão de identidade ---- */}
      <section className="reveal overflow-hidden rounded-2xl border border-line bg-surface/60">
        <div className="relative h-32 lg:h-44">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 160% at 15% 0%, rgba(244,206,31,0.22), transparent 55%), linear-gradient(120deg,#17140a,#0e0e12 60%,#0a0a0b)",
            }}
          />
          <Image
            src="/emblema.png"
            alt=""
            aria-hidden="true"
            width={365}
            height={365}
            className="pointer-events-none absolute -right-4 top-1/2 w-40 -translate-y-1/2 opacity-[0.08] lg:w-56"
          />
          <div className="absolute inset-0 opacity-40 [background:repeating-linear-gradient(135deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_6px)]" />
        </div>

        <div className="px-5 pb-6 lg:px-8">
          <div className="relative z-10 -mt-12 flex items-end justify-between gap-4 lg:-mt-14">
            <AvatarCandidato candidato={cand} className="h-24 w-24 text-3xl lg:h-28 lg:w-28 lg:text-4xl" />
            <Link href="/porta-voz/perfil/editar" className="btn-ghost mb-1 w-auto px-4 text-sm">
              Editar perfil
            </Link>
          </div>

          <NomeCandidato
            candidato={cand}
            className="mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl"
          />
          <DadosCandidato candidato={cand} />
          {cand.desde && (
            <p className="mt-1 text-sm text-muted-2">na guilda desde {cand.desde}</p>
          )}

          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
            <Stat valor={String(minhas.length)} rotulo="missões" />
            <Stat valor={String(naFila)} rotulo="na fila" />
            <Stat valor={String(emProducao)} rotulo="em produção" />
            <Stat valor={String(prontas)} rotulo="prontas" />
          </dl>
        </div>
      </section>

      <div className="mt-6 flex flex-col gap-6">
        <Card titulo="Missões criadas">
          {minhas.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma missão criada ainda.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {minhas.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface/40 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-text">
                      {p.titulo}
                    </h3>
                    {p.reservadaPor && (
                      <p className="mt-0.5 text-xs text-muted-2">editor: {p.reservadaPor}</p>
                    )}
                  </div>
                  <span className="rounded-full border border-line bg-ink-2 px-3 py-1 text-xs text-muted">
                    {ROTULO_STATUS[p.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card titulo="Histórico" delay={0.05}>
          {historico.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma missão concluída ainda.</p>
          ) : (
            <ol className="relative ml-1">
              {historico.map((h, i) => {
                const ok = h.status === "aprovada" || h.status === "finalizada";
                const ultimo = i === historico.length - 1;
                return (
                  <li key={h.id} className="relative flex gap-4 pb-5 last:pb-0">
                    {!ultimo && (
                      <span className="absolute left-[7px] top-4 h-full w-px bg-line" />
                    )}
                    <span
                      className={`relative mt-1 h-3.5 w-3.5 flex-none rounded-full border-2 ${
                        ok ? "border-ok bg-ok/30" : "border-gold bg-gold/30"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text">{h.titulo}</p>
                      <p className="text-xs text-muted-2">
                        {h.reservadaPor ?? "—"} ·{" "}
                        <span className={ok ? "text-ok" : "text-gold"}>
                          {h.status === "finalizada"
                            ? "concluída"
                            : h.status === "aprovada"
                              ? "pronta pra conferir"
                              : "reedição pedida"}
                        </span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
