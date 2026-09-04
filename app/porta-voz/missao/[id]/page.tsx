import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { missionByIdOfSpokesperson, queuePosition, totalInQueue } from "@/lib/missions-db";
import { requireSession } from "@/lib/server-session";
import { looksLikeLink, looksLikeDriveLink, looksLikeYoutubeLink } from "@/lib/validators";
import {
  MISSION_STAGES,
  FORMAT_LABELS,
  currentStage,
  spokespersonStatusMessage,
} from "@/lib/missions";
import { MissionActions } from "@/components/mission-actions";
import { MissionChat } from "@/components/mission-chat";
import { ReportButton } from "@/components/report-button";
import { missionMessages } from "@/lib/chat-db";
import { IconPlay, IconFolder } from "@/components/action-icons";

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
  const midnight = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(new Date()) - midnight(new Date(iso))) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  return months === 1 ? "há 1 mês" : `há ${months} meses`;
}

/** Título de bloco: um risco de ouro e o nome, sem virar mais um cartão. */
function BlockTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-gold">
      {children}
    </h2>
  );
}

function BriefLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="border-b border-line-soft py-3 last:border-0">
      <dt className="text-xs uppercase tracking-wide text-muted-2">{label}</dt>
      <dd
        className={
          value
            ? "mt-1 whitespace-pre-line text-sm leading-relaxed text-text"
            : "mt-1 text-sm italic text-muted-2"
        }
      >
        {value ?? "não informado"}
      </dd>
    </div>
  );
}

export default async function MissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id: rawId } = await params;

  const numId = Number(String(rawId).replace(/^db-/, ""));
  if (!Number.isInteger(numId)) notFound();

  const [mission, position, total, messages] = await Promise.all([
    missionByIdOfSpokesperson(numId, session.id),
    queuePosition(numId),
    totalInQueue(),
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
  const needsMyDecision = isInReview || isApproved;

  const hasRawVideo =
    (driveLink && looksLikeDriveLink(driveLink)) ||
    (youtubeLink && looksLikeYoutubeLink(youtubeLink));

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-16 lg:px-8">
      {/* sem padding próprio: o container já tem px-5, e o -ml-3 do link só
          desconta o padding interno do link-toque pra o texto cair nos 20px */}
      <div className="pt-4">
        <Link
          href="/porta-voz"
          className="link-toque -ml-3 text-sm text-muted hover:text-silver-hi"
        >
          ← Minhas missões
        </Link>
      </div>

      {/* Onde a missão está, antes de qualquer outra coisa. */}
      <header className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface/60">
        <div
          className="h-1 w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(244,206,31,0.6), rgba(244,206,31,0.9), rgba(244,206,31,0.6), transparent)",
          }}
          aria-hidden="true"
        />
        <div className="p-5 lg:p-6">
          <p className={`text-sm font-semibold ${msg.color}`}>{msg.text}</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold leading-tight text-text lg:text-3xl">
            {title}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-2">
            <span>{FORMAT_LABELS[format as keyof typeof FORMAT_LABELS] ?? format}</span>
            <span aria-hidden="true">·</span>
            <span>criada {timeSince(createdAt)}</span>
            {desiredDeadline && (
              <>
                <span aria-hidden="true">·</span>
                <span>prazo {formatPureDate(desiredDeadline)}</span>
              </>
            )}
          </div>

          {isAvailable && position > 0 && (
            <p className="mt-3 text-xs text-muted">
              Posição <b className="text-text">{position}</b> de {total} na fila dos
              editores
            </p>
          )}

          {reservedBy && (
            <p className="mt-3 text-sm text-muted">
              Com o editor <span className="font-medium text-text">{reservedBy}</span>
              {reservedAt && (
                <span className="text-muted-2"> desde {formatDate(reservedAt, false)}</span>
              )}
            </p>
          )}

          {/* A trilha da missão, enrolando em vez de esticar a tela. */}
          <ol className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-xs">
            {MISSION_STAGES.map((name, i) => {
              const passed = i < stage;
              const isCurrent = i === stage;
              return (
                <li key={name} className="flex items-center gap-1.5">
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

      {/* Assistir vem antes de decidir: sem ver o vídeo, o botão de aprovar não
          significa nada. */}
      {deliveryLink && looksLikeLink(deliveryLink) && (
        <a
          href={deliveryLink}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-gold mt-5 gap-2"
          data-guia="ver-entrega"
        >
          <IconPlay className="h-[18px] w-[18px]" />
          Assistir ao vídeo entregue
        </a>
      )}

      {needsMyDecision && (
        <div className="mt-5">
          <MissionActions id={mission.id} inReview={isInReview} />
        </div>
      )}

      {/* Enquanto o editor trabalha, a única ação útil é falar com ele. */}
      {reservedBy && !needsMyDecision && (
        <a href="#conversa" className="btn-ghost mt-5">
          Enviar nova orientação ao editor
        </a>
      )}

      {inspectorNotes && (
        <section className="mt-8">
          <BlockTitle>
            {reeditRequestedBy === "spokesperson" || reeditRequestedBy === "porta_voz"
              ? "O ajuste que você pediu"
              : "Observação do controle de qualidade"}
          </BlockTitle>
          <p className="rounded-2xl border border-line bg-surface/40 p-4 text-sm leading-relaxed text-muted">
            {inspectorNotes}
          </p>
        </section>
      )}

      {hasRawVideo && (
        <section className="mt-8">
          <BlockTitle>Vídeo bruto que você mandou</BlockTitle>
          <div className="flex flex-col gap-2 sm:flex-row">
            {driveLink && looksLikeDriveLink(driveLink) && (
              <a
                href={driveLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm text-gold-hi transition-colors hover:border-gold/40 hover:bg-surface-2"
              >
                <IconFolder className="h-4 w-4" />
                Abrir no Google Drive
              </a>
            )}
            {youtubeLink && looksLikeYoutubeLink(youtubeLink) && (
              <a
                href={youtubeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm text-gold-hi transition-colors hover:border-gold/40 hover:bg-surface-2"
              >
                <IconPlay className="h-4 w-4" />
                Abrir no YouTube
              </a>
            )}
          </div>
        </section>
      )}

      {/* Recolhido: quem já mandou o briefing raramente precisa relê-lo, mas
          precisa achá-lo quando o editor pergunta. */}
      <details className="group mt-8 rounded-2xl border border-line bg-surface/40">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-medium uppercase tracking-[0.14em] text-gold">
          O que você pediu
          <span
            aria-hidden="true"
            className="text-muted-2 transition-transform group-open:rotate-180"
          >
            ▾
          </span>
        </summary>
        <dl className="px-4 pb-2">
          <BriefLine label="Objetivo da edição" value={reason} />
          <BriefLine label="Trechos e cortes" value={extras} />
          <BriefLine label="Referências" value={refs} />
          <BriefLine label="Tom" value={tone} />
          <BriefLine label="Cor" value={color} />
          <BriefLine label="Fonte da legenda" value={font} />
        </dl>
      </details>

      <section id="conversa" className="mt-8 scroll-mt-4" data-guia="conversa-missao">
        <MissionChat missionId={mission.id} messages={messages} />
      </section>

      <div className="mt-10">
        <ReportButton missionId={mission.id} />
      </div>
    </div>
  );
}
