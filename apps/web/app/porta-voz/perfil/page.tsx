import { getCandidate } from "@oficina/domain/candidates";
import {
  DEMO_MISSIONS,
  STATUS_LABEL,
  spokespersonBucket,
  spokespersonStatusMessage,
  waitingOnSpokesperson,
} from "@oficina/domain/missions";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { CandidateData } from "@/components/candidate-data";
import { CandidateName } from "@/components/candidate-name";
import { EmptyState } from "@/components/empty-state";
import { MissionCounters } from "@/components/mission-counters";
import { readOwnCandidate } from "@/lib/candidate-db";
import { spokespersonMissions } from "@/lib/missions-db";
import { requireSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Meu Perfil — Oficina Amarela" };
export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const isReal = (id: string) => id.startsWith("db-");

export default async function SpokespersonProfilePage() {
  const session = await requireSession();

  const [candOpt, realMine] = await Promise.all([
    readOwnCandidate(session.id),
    spokespersonMissions(session.id),
  ]);
  const cand = candOpt ?? getCandidate(session.name);

  const demo =
    process.env.NODE_ENV !== "production"
      ? DEMO_MISSIONS.filter((p) => (p.spokesperson ?? (p as any).portaVoz) === session.name)
      : [];
  const myMissions = [...realMine, ...demo];

  // uma lista só, da mais recente pra mais antiga — antes eram duas seções
  // ("Missões criadas" e "Histórico") mostrando quase o mesmo conjunto
  const history = [...myMissions].sort((a, b) => {
    const aDate = a.createdAt ?? (a as any).criadaEm ?? "";
    const bDate = b.createdAt ?? (b as any).criadaEm ?? "";
    return bDate.localeCompare(aDate);
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 lg:px-8 lg:py-10">
      <section className="reveal overflow-hidden rounded-2xl border border-line bg-surface/60">
        <div className="relative h-28 lg:h-40">
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
            className="pointer-events-none absolute -right-4 top-1/2 w-36 -translate-y-1/2 opacity-[0.08] lg:w-56"
          />
          <div className="absolute inset-0 opacity-40 [background:repeating-linear-gradient(135deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_6px)]" />
        </div>

        <div className="px-5 pb-6 lg:px-8">
          <div className="relative z-10 -mt-12 lg:-mt-14">
            <CandidateAvatar
              candidate={cand}
              className="h-24 w-24 text-3xl lg:h-28 lg:w-28 lg:text-4xl"
            />
          </div>

          <CandidateName
            candidate={cand}
            className="mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl"
          />
          <CandidateData candidate={cand} />
          {cand.since && <p className="mt-1 text-sm text-muted-2">na guilda desde {cand.since}</p>}

          {/* Botão inteiro no celular: é a única ação da tela, não pode ser
              um link espremido no canto de cima. */}
          <Link
            href="/porta-voz/perfil/editar"
            className="btn-gold mt-6 sm:w-56"
            data-guia="editar-perfil"
          >
            Editar perfil
          </Link>
        </div>
      </section>

      <div className="mt-6">
        <MissionCounters missions={myMissions} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-gold">
          Histórico de missões
        </h2>

        {history.length === 0 ? (
          <EmptyState
            title="Nenhuma missão criada ainda."
            description="Quando você mandar o primeiro vídeo pra guilda, ele aparece aqui."
          >
            <Link href="/porta-voz/nova-pauta" className="btn-gold sm:w-56">
              Criar a primeira
            </Link>
          </EmptyState>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-line bg-surface/40">
            {history.map((h) => {
              const title = h.title ?? (h as any).titulo;
              const reservedBy = h.reservedBy ?? (h as any).reservadaPor;
              const createdAt = h.createdAt ?? (h as any).criadaEm ?? "";
              const status = h.status;
              const bucket = spokespersonBucket(status);
              const msg = spokespersonStatusMessage(status);
              const real = isReal(h.id);

              const row = (
                <>
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${
                      waitingOnSpokesperson(status)
                        ? "bg-gold"
                        : bucket === "done"
                          ? "bg-ok"
                          : bucket === "reviewing"
                            ? "bg-silver-hi"
                            : bucket === "editing"
                              ? "bg-silver"
                              : "bg-muted-2"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug text-text">
                      {title}
                    </span>
                    <span className={`mt-0.5 block text-xs ${msg.color}`}>
                      {STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-2">
                      {reservedBy ? `${reservedBy} · ` : ""}
                      {formatDate(createdAt)}
                    </span>
                  </span>
                </>
              );

              return (
                <li key={h.id} className="border-b border-line-soft last:border-0">
                  {real ? (
                    <Link
                      href={`/porta-voz/missao/${h.id}`}
                      className="flex min-h-11 items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2"
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className="flex min-h-11 items-start gap-3 px-4 py-3.5">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
