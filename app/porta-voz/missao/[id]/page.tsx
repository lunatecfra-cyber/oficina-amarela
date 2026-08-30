import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { MissionActions } from "@/components/mission-actions";
import { MissionChat } from "@/components/mission-chat";
import { ReportButton } from "@/components/report-button";
import { readOwnCandidate } from "@/lib/candidate-db";
import { missionMessages } from "@/lib/chat-db";
import {
  currentStage,
  FORMAT_LABELS,
  MISSION_STAGES,
  STATUS_LABELS,
  spokespersonStatusMessage,
} from "@/lib/missions";
import { missionByIdOfSpokesperson, queuePosition, totalInQueue } from "@/lib/missions-db";
import { requireSession } from "@/lib/server-session";
import { looksLikeDriveLink, looksLikeLink, looksLikeYoutubeLink } from "@/lib/validators";

export const metadata: Metadata = { title: "Missão — Oficina Amarela" };
export const dynamic = "force-dynamic";

function formatDate(iso: string, withYear = true) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

function formatPureDate(ymd: string) {
  return new Date(ymd).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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

export default async function MissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id: rawId } = await params;

  const numId = Number(String(rawId).replace(/^db-/, ""));
  if (!Number.isInteger(numId)) notFound();

  const [mission, position, total, candidate, messages] = await Promise.all([
    missionByIdOfSpokesperson(numId, session.id),
    queuePosition(numId),
    totalInQueue(),
    readOwnCandidate(session.id),
    missionMessages(numId),
  ]);
  if (!mission) notFound();

  const msg = spokespersonStatusMessage(mission.status);
  const stage = currentStage(mission.status);

  const title = mission.title ?? (mission as any).titulo;
  const format = mission.format ?? (mission as any).formato;
  const status = mission.status;
  const createdAt = mission.createdAt ?? (mission as any).criadaEm ?? "";
  const desiredDeadline = mission.desiredDeadline ?? (mission as any).prazoDesejado;
  const brief = mission.brief ?? {};
  const tone = brief.tone ?? (brief as any).tom;
  const color = brief.color ?? (brief as any).cor;
  const font = brief.font ?? (brief as any).fonte;
  const refs = brief.refs;
  const extras = mission.extras;
  const reason = mission.reason ?? (mission as any).motivo;
  const reservedBy = mission.reservedBy ?? (mission as any).reservadaPor;
  const reservedAt = mission.reservedAt ?? (mission as any).reservadaEm;
  const deliveryLink = mission.deliveryLink ?? (mission as any).entregaLink;
  const driveLink = mission.driveLink;
  const youtubeLink = mission.youtubeLink;
  const inspectorNotes = mission.inspectorNotes ?? (mission as any).notasInspetor;
  const reeditRequestedBy = mission.reeditRequestedBy ?? (mission as any).reedicaoPedidaPor;

  const isInReview = status === "in_review" || (status as any) === "em_revisao";
  const isApproved = status === "approved" || (status as any) === "aprovada";
  const isAvailable = status === "available" || (status as any) === "disponivel";

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

      <header className="mb-8 overflow-hidden rounded-2xl border border-line bg-surface/60">
        <div
          className="h-1 w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(244,206,31,0.6), rgba(244,206,31,0.9), rgba(244,206,31,0.6), transparent)",
          }}
          aria-hidden="true"
        />
        <div className="p-5 lg:p-6">
          <p className={`text-sm font-medium ${msg.color}`}>{msg.text}</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
            {title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-2">
            <span className="rounded-full border border-line bg-ink-2 px-2.5 py-0.5">
              {FORMAT_LABELS[format as keyof typeof FORMAT_LABELS] ?? format}
            </span>
            <span>
              {STATUS_LABELS[status as keyof typeof STATUS_LABELS] ??
                (STATUS_LABELS as any)[status] ??
                status}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              criada {timeSince(createdAt)} · {formatDate(createdAt)}
            </span>
          </div>

          {isAvailable && position > 0 && (
            <p className="mt-3 text-xs text-muted">
              Posição <b className="text-text">{position}</b> de {total} na fila dos editores
            </p>
          )}

          <ol className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-[11px]">
            {MISSION_STAGES.map((name, i) => {
              const passed = i < stage;
              const isCurrent = i === stage;
              return (
                <li key={name} className="flex items-center gap-2">
                  <span
                    className={
                      isCurrent
                        ? "rounded-full border border-gold-lo/60 bg-gold/10 px-2.5 py-0.5 font-medium text-gold-hi"
                        : passed
                          ? "text-gold-lo"
                          : "text-muted-2"
                    }
                  >
                    {passed && !isCurrent ? "✓ " : ""}
                    {name}
                  </span>
                  {i < MISSION_STAGES.length - 1 && (
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

      {(isInReview || isApproved) && <MissionActions id={mission.id} inReview={isInReview} />}

      {candidate && (
        <section className="mb-8 flex items-center gap-4 rounded-2xl border border-line bg-surface/60 p-5">
          <CandidateAvatar candidate={candidate} className="h-14 w-14 text-lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text">
              {candidate.name ?? (candidate as any).nome}
            </p>
            {(candidate.location ?? (candidate as any).local) && (
              <p className="mt-0.5 text-xs text-muted">
                {candidate.location ?? (candidate as any).local}
              </p>
            )}
          </div>
        </section>
      )}

      {(reservedBy || deliveryLink) && (
        <section className="mb-8 rounded-2xl border border-line bg-surface/60 p-5">
          {reservedBy && (
            <p className="text-sm text-muted">
              Editor responsável: <span className="font-medium text-text">{reservedBy}</span>
            </p>
          )}
          {reservedAt && (
            <p className="mt-1 text-xs text-muted-2">
              Com o editor desde {formatDate(reservedAt, false)} · sem prazo — é dele até entregar
              ou devolver
            </p>
          )}
          {deliveryLink && looksLikeLink(deliveryLink) && (
            <a
              href={deliveryLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold mt-3 inline-block w-auto px-5"
              data-guia="ver-entrega"
            >
              ▶ Ver vídeo entregue
            </a>
          )}
        </section>
      )}

      {((driveLink && looksLikeDriveLink(driveLink)) ||
        (youtubeLink && looksLikeYoutubeLink(youtubeLink))) && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-gold">
            Vídeo bruto
          </h2>
          <div className="flex flex-wrap gap-2">
            {driveLink && looksLikeDriveLink(driveLink) && (
              <a
                href={driveLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm text-gold-hi transition-colors hover:border-gold/40 hover:bg-surface-2"
              >
                📁 Abrir no Google Drive
              </a>
            )}
            {youtubeLink && looksLikeYoutubeLink(youtubeLink) && (
              <a
                href={youtubeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm text-gold-hi transition-colors hover:border-gold/40 hover:bg-surface-2"
              >
                ▶ Abrir no YouTube
              </a>
            )}
          </div>
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-gold">
          Briefing (como você pediu)
        </h2>
        <dl className="grid gap-3 rounded-2xl border border-line bg-surface/40 p-5 sm:grid-cols-2">
          {(
            [
              ["Prazo desejado", desiredDeadline ? formatPureDate(desiredDeadline) : undefined],
              ["Tom", tone],
              ["Cor", color],
              ["Fonte / legenda", font],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] uppercase tracking-wide text-muted-2">{label}</dt>
              <dd
                className={
                  value ? "mt-0.5 text-sm text-text" : "mt-0.5 text-sm text-muted-2 italic"
                }
              >
                {value ?? "não informado"}
              </dd>
            </div>
          ))}
          {(
            [
              ["Referências", refs],
              ["Cortes específicos", extras],
              ["Por que esse vídeo importa", reason],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="sm:col-span-2">
              <dt className="text-[11px] uppercase tracking-wide text-muted-2">{label}</dt>
              <dd
                className={`mt-0.5 text-sm ${value ? "whitespace-pre-line text-text" : "text-muted-2 italic"}`}
              >
                {value ?? "não informado"}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {inspectorNotes && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-gold">
            {reeditRequestedBy === "spokesperson" || reeditRequestedBy === "porta_voz"
              ? "O ajuste que você pediu"
              : "Observação do controle de qualidade"}
          </h2>
          <p className="rounded-2xl border border-line bg-surface/40 p-5 text-sm leading-relaxed text-muted">
            {inspectorNotes}
          </p>
        </section>
      )}

      <div className="mb-6" data-guia="conversa-missao">
        <MissionChat missionId={mission.id} messages={messages} />
      </div>

      <ReportButton missionId={mission.id} />
    </div>
  );
}
