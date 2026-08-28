import type { Metadata } from "next";
import Link from "next/link";
import {
  MISSIONS,
  FORMAT_LABELS,
  STATUS_LABELS,
  spokespersonStatusMessage,
  type Mission,
  type MissionStatus,
} from "@/lib/missions";
import { availableMissions, spokespersonMissions } from "@/lib/missions-db";
import { readCandidateOnboarding } from "@/lib/candidate-db";
import { readSession } from "@/lib/server-session";
import { IncompleteProfileBanner } from "@/components/incomplete-profile-banner";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minhas Missões — Oficina Amarela" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function timeSince(iso: string) {
  const midnight = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round(
    (midnight(new Date()) - midnight(new Date(iso))) / 86_400_000,
  );
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  return months === 1 ? "há 1 mês" : `há ${months} meses`;
}

function statusBorderColor(status: MissionStatus): string {
  switch (status) {
    case "available":
    case "disponivel":
      return "border-l-muted";
    case "reserved":
    case "reservada":
    case "mine":
    case "minha":
      return "border-l-gold";
    case "in_review":
    case "em_revisao":
      return "border-l-silver-hi";
    case "reedit":
    case "reedicao":
      return "border-l-silver";
    case "approved":
    case "aprovada":
      return "border-l-ok";
    case "finished":
    case "finalizada":
      return "border-l-ok";
    default:
      return "";
  }
}

function GoldStripe() {
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

function BadgePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-ink-2 px-2.5 py-0.5 text-[11px] font-medium text-muted-2">
      {children}
    </span>
  );
}

const isReal = (id: string) => id.startsWith("db-");

function MissionCardContainer({
  mission,
  guide,
  children,
}: {
  mission: Mission;
  guide?: string;
  children: React.ReactNode;
}) {
  const real = isReal(mission.id);
  return (
    <li
      data-guia={guide}
      data-guide={guide}
      className={`overflow-hidden rounded-2xl border border-l-[3px] border-line bg-surface/60 ${
        statusBorderColor(mission.status)
      } ${real ? "transition-colors hover:border-gold/40 hover:bg-surface-2" : ""}`}
    >
      {real && <GoldStripe />}
      <div className="p-4 lg:p-5">
        {real ? (
          <Link href={`/spokesperson/mission/${mission.id}`} className="group block">
            {children}
          </Link>
        ) : (
          children
        )}
      </div>
    </li>
  );
}

export default async function SpokespersonHome() {
  const session = await readSession();
  const DEMO_MODE = process.env.NODE_ENV !== "production";

  const [realMine, realAvailable, onboarding] = await Promise.all([
    session ? spokespersonMissions(session.id) : Promise.resolve([]),
    availableMissions(),
    session ? readCandidateOnboarding(session.id) : Promise.resolve(null),
  ]);
  const isIncompleteProfile = onboarding ? !onboarding.profileComplete : true;

  const demoMine = DEMO_MODE ? MISSIONS.filter((p) => (p.spokesperson ?? (p as any).portaVoz) === session?.name) : [];
  const myMissions = [...realMine, ...demoMine];

  const demoAvailable = DEMO_MODE ? MISSIONS.filter((p) => p.status === "available" || (p as any).status === "disponivel") : [];
  const generalQueue = [
    ...realAvailable,
    ...demoAvailable,
  ].sort((a, b) => {
    const aDate = a.createdAt ?? (a as any).criadaEm ?? "";
    const bDate = b.createdAt ?? (b as any).criadaEm ?? "";
    return aDate.localeCompare(bDate);
  });

  const inQueue = myMissions.filter((p) => p.status === "available" || (p as any).status === "disponivel");
  const inProgress = myMissions.filter((p) => p.status !== "available" && (p as any).status !== "disponivel");

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-12">
      {isIncompleteProfile && (
        <div className="mb-6">
          <IncompleteProfileBanner role="spokesperson" />
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
            Minhas missões
          </h1>
          <p className="mt-1 text-sm text-muted">
            Acompanhe o status de cada vídeo que você mandou pra guilda.
          </p>
        </div>
        <Link
          href="/spokesperson/new-mission"
          className="btn-gold w-auto px-6"
          data-guia="nova-missao"
        >
          + Nova missão
        </Link>
      </div>

      {myMissions.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-line p-12 text-center">
          <p className="text-muted">Você ainda não criou nenhuma missão.</p>
          <Link
            href="/spokesperson/new-mission"
            className="mt-4 inline-block font-medium text-gold-hi hover:underline"
          >
            Criar a primeira
          </Link>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {inQueue.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-gold">
                Na fila
              </h2>
              <ul className="flex flex-col gap-3">
                {inQueue.map((p, n) => {
                  const idx = generalQueue.findIndex((f) => f.id === p.id);
                  const position = idx >= 0 ? idx + 1 : 0;
                  const total = generalQueue.length;
                  const real = isReal(p.id);
                  const title = p.title ?? (p as any).titulo;
                  const format = p.format ?? (p as any).formato;
                  const createdAt = p.createdAt ?? (p as any).criadaEm ?? "";

                  return (
                    <MissionCardContainer
                      key={p.id}
                      mission={p}
                      guide={
                        n === 0 && inProgress.length === 0 ? "cartao-missao" : undefined
                      }
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text transition-colors group-hover:text-gold-hi">
                          {title}
                        </h3>
                        <BadgePill>{FORMAT_LABELS[format as keyof typeof FORMAT_LABELS] ?? format}</BadgePill>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-2">
                        <span>
                          criada {timeSince(createdAt)} · {formatDate(createdAt)}
                        </span>
                        {position > 0 && (
                          <span>
                            Posição <b className="text-text">{position}</b> de {total}
                          </span>
                        )}
                      </div>
                      {!real && (
                        <span className="mt-2 inline-block rounded-full border border-line-soft bg-ink-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-2">
                          Demonstração
                        </span>
                      )}
                    </MissionCardContainer>
                  );
                })}
              </ul>
            </section>
          )}

          {inProgress.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-gold">
                Em andamento e concluídas
              </h2>
              <ul className="flex flex-col gap-3">
                {inProgress.map((p, n) => {
                  const msg = spokespersonStatusMessage(p.status);
                  const real = isReal(p.id);
                  const title = p.title ?? (p as any).titulo;
                  const format = p.format ?? (p as any).formato;
                  const status = p.status;
                  const createdAt = p.createdAt ?? (p as any).criadaEm ?? "";
                  const reservedBy = p.reservedBy ?? (p as any).reservadaPor;
                  const inspectorNotes = p.inspectorNotes ?? (p as any).notasInspetor;
                  const deliveryLink = p.deliveryLink ?? (p as any).entregaLink;
                  const desiredDeadline = p.desiredDeadline ?? (p as any).prazoDesejado;

                  return (
                    <MissionCardContainer
                      key={p.id}
                      mission={p}
                      guide={n === 0 ? "cartao-missao" : undefined}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text transition-colors group-hover:text-gold-hi">
                            {title}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-2">
                            <BadgePill>{FORMAT_LABELS[format as keyof typeof FORMAT_LABELS] ?? format}</BadgePill>
                            <span className="rounded-full border border-line bg-ink-2 px-2.5 py-0.5 text-[11px] font-medium text-muted-2">
                              {STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? (STATUS_LABELS as any)[(p as any).status] ?? status}
                            </span>
                            <span>
                              criada {timeSince(createdAt)} · {formatDate(createdAt)}
                            </span>
                          </div>
                          {reservedBy && (
                            <p className="mt-1 text-xs text-muted">
                              editor: {reservedBy}
                            </p>
                          )}
                          {(status === "reedit" || (status as any) === "reedicao") && inspectorNotes && (
                            <p className="mt-1.5 text-xs italic text-muted-2">
                              &ldquo;{inspectorNotes}&rdquo;
                            </p>
                          )}
                        </div>
                        {msg.text && (
                          <span
                            className={`flex-none text-sm font-medium sm:text-right ${msg.color}`}
                          >
                            {msg.text}
                          </span>
                        )}
                      </div>
                      {deliveryLink && (
                        <p className="mt-2 flex items-center gap-2 rounded-xl border border-gold-lo/50 bg-gold/[0.07] px-3 py-2 text-xs font-medium text-gold-hi">
                          <span aria-hidden="true">🎬</span>
                          {status === "in_review" || (status as any) === "em_revisao"
                            ? "O vídeo já está pronto — toque pra assistir enquanto a conferência acontece"
                            : "Vídeo pronto — toque pra assistir"}
                        </p>
                      )}

                      {desiredDeadline && (
                        <p className="mt-2 text-xs text-muted-2">
                          ⏰ Prazo:{" "}
                          {new Date(desiredDeadline).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </p>
                      )}
                      {!real && (
                        <span className="mt-2 inline-block rounded-full border border-line-soft bg-ink-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-2">
                          Demonstração
                        </span>
                      )}
                    </MissionCardContainer>
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
