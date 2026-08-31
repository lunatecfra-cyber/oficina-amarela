import {
  FORMAT_LABELS,
  MISSIONS,
  type MissionStatus,
  type SpokespersonBucket,
  STATUS_LABELS,
  spokespersonBucket,
  spokespersonStatusMessage,
  waitingOnSpokesperson,
} from "@oficina/domain/missions";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { IncompleteProfileBanner } from "@/components/incomplete-profile-banner";
import { MissionCounters } from "@/components/mission-counters";
import { readCandidateOnboarding } from "@/lib/candidate-db";
import { availableMissions, spokespersonMissions } from "@/lib/missions-db";
import { readSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minhas Missões — Oficina Amarela" };

function _formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function formatDeadline(ymd: string) {
  return new Date(ymd).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function timeSince(iso: string) {
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(new Date()) - midnight(new Date(iso))) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  return months === 1 ? "há 1 mês" : `há ${months} meses`;
}

/** A tarja colorida na lateral esquerda — o status lido de relance. */
function bucketStripe(bucket: SpokespersonBucket, waiting: boolean): string {
  if (waiting) return "border-l-gold";
  switch (bucket) {
    case "waiting_editor":
      return "border-l-muted-2";
    case "editing":
      return "border-l-silver";
    case "reviewing":
      return "border-l-silver-hi";
    case "done":
      return "border-l-ok";
  }
}

const isReal = (id: string) => id.startsWith("db-");

/** Ordem de leitura: primeiro o que depende de você, por último o encerrado. */
const BUCKET_ORDER: Record<SpokespersonBucket, number> = {
  reviewing: 0,
  editing: 1,
  waiting_editor: 2,
  done: 3,
};

export default async function SpokespersonHome() {
  const session = await readSession();
  const DEMO_MODE = process.env.NODE_ENV !== "production";

  const [realMine, realAvailable, onboarding] = await Promise.all([
    session ? spokespersonMissions(session.id) : Promise.resolve([]),
    availableMissions(),
    session ? readCandidateOnboarding(session.id) : Promise.resolve(null),
  ]);
  const isIncompleteProfile = onboarding ? !onboarding.profileComplete : true;

  const demoMine = DEMO_MODE
    ? MISSIONS.filter((p) => (p.spokesperson ?? (p as any).portaVoz) === session?.name)
    : [];
  const myMissions = [...realMine, ...demoMine];

  const demoAvailable = DEMO_MODE
    ? MISSIONS.filter((p) => p.status === "available" || (p as any).status === "disponivel")
    : [];
  const generalQueue = [...realAvailable, ...demoAvailable].sort((a, b) => {
    const aDate = a.createdAt ?? (a as any).criadaEm ?? "";
    const bDate = b.createdAt ?? (b as any).criadaEm ?? "";
    return aDate.localeCompare(bDate);
  });

  const awaitingMe = myMissions.filter((m) => waitingOnSpokesperson(m.status));

  // uma lista só, do que pede atenção pro que já acabou
  const ordered = [...myMissions].sort((a, b) => {
    const aWait = waitingOnSpokesperson(a.status) ? 0 : 1;
    const bWait = waitingOnSpokesperson(b.status) ? 0 : 1;
    if (aWait !== bWait) return aWait - bWait;

    const byBucket =
      BUCKET_ORDER[spokespersonBucket(a.status)] - BUCKET_ORDER[spokespersonBucket(b.status)];
    if (byBucket !== 0) return byBucket;

    const aDate = a.createdAt ?? (a as any).criadaEm ?? "";
    const bDate = b.createdAt ?? (b as any).criadaEm ?? "";
    return bDate.localeCompare(aDate);
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 lg:px-8 lg:py-10">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
        Minhas missões
      </h1>
      <p className="mt-1 text-sm text-muted">
        Cada vídeo que você mandou pra guilda, e em que pé está.
      </p>

      {/* O botão fica antes de tudo: no celular é a ação que a pessoa mais repete. */}
      <Link href="/porta-voz/nova-pauta" className="btn-gold mt-5 w-full" data-guia="nova-missao">
        Criar missão
      </Link>

      {isIncompleteProfile && (
        <div className="mt-4">
          <IncompleteProfileBanner role="spokesperson" />
        </div>
      )}

      {myMissions.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Você ainda não criou nenhuma missão."
            description="Mande um vídeo bruto e diga o que quer. Um editor da guilda pega e devolve o corte pronto."
          />
        </div>
      ) : (
        <>
          {/* Resumo: quatro números numa faixa só, sem virar quatro cartões. */}
          <div className="mt-6">
            <MissionCounters missions={myMissions} />
          </div>

          {/* O próximo passo da tela, quando existe um. */}
          {awaitingMe.length > 0 && (
            <p className="mt-4 rounded-xl border border-gold-lo/50 bg-gold/[0.07] px-4 py-3 text-sm font-medium text-gold-hi">
              {awaitingMe.length === 1
                ? "1 vídeo está pronto e espera o seu aceite."
                : `${awaitingMe.length} vídeos estão prontos e esperam o seu aceite.`}
            </p>
          )}

          <ul className="mt-6 flex flex-col gap-2.5">
            {ordered.map((p, n) => {
              const real = isReal(p.id);
              const title = p.title ?? (p as any).titulo;
              const format = p.format ?? (p as any).formato;
              const status = p.status as MissionStatus;
              const createdAt = p.createdAt ?? (p as any).criadaEm ?? "";
              const reservedBy = p.reservedBy ?? (p as any).reservadaPor;
              const desiredDeadline = p.desiredDeadline ?? (p as any).prazoDesejado;

              const bucket = spokespersonBucket(status);
              const waiting = waitingOnSpokesperson(status);
              const msg = spokespersonStatusMessage(status);

              const queueIndex = generalQueue.findIndex((f) => f.id === p.id);
              const position = queueIndex >= 0 ? queueIndex + 1 : 0;

              const body = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 flex-1 font-[family-name:var(--font-display)] text-base font-semibold leading-snug text-text transition-colors group-hover:text-gold-hi lg:text-lg">
                      {title}
                    </h2>
                    {waiting && (
                      <span className="mt-0.5 flex-none rounded-full bg-gold px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-ink">
                        Sua vez
                      </span>
                    )}
                  </div>

                  <p className={`mt-1.5 text-sm font-medium ${msg.color}`}>{msg.text}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-2">
                    <span>{FORMAT_LABELS[format as keyof typeof FORMAT_LABELS] ?? format}</span>
                    <span aria-hidden="true">·</span>
                    <span>{STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}</span>
                    {desiredDeadline && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>prazo {formatDeadline(desiredDeadline)}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>criada {timeSince(createdAt)}</span>
                  </div>

                  {(reservedBy || (bucket === "waiting_editor" && position > 0)) && (
                    <p className="mt-1.5 text-xs text-muted">
                      {reservedBy
                        ? `com o editor ${reservedBy}`
                        : `posição ${position} de ${generalQueue.length} na fila`}
                    </p>
                  )}

                  {!real && (
                    <span className="mt-2 inline-block rounded-full border border-line-soft bg-ink-2 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-muted-2">
                      Demonstração
                    </span>
                  )}
                </>
              );

              return (
                <li
                  key={p.id}
                  data-guia={n === 0 ? "cartao-missao" : undefined}
                  data-guide={n === 0 ? "cartao-missao" : undefined}
                  className={`rounded-2xl border border-l-[3px] border-line bg-surface/50 ${bucketStripe(
                    bucket,
                    waiting,
                  )} ${real ? "transition-colors hover:border-gold/40 hover:bg-surface-2" : ""}`}
                >
                  {real ? (
                    <Link
                      href={`/porta-voz/missao/${p.id}`}
                      className="group block px-4 py-3.5 lg:px-5 lg:py-4"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="px-4 py-3.5 lg:px-5 lg:py-4">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
