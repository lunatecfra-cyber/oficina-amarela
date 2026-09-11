/**
 * Admin notification center: derived by combining queries that already
 * exist (queue, in-flight, reports) — no table, no migration.
 *
 * The 3- and 5-day thresholds are not invented here: they're the same ones
 * `apps/web/components/overview-panel.tsx` already uses to highlight stalled
 * items. Still an inherited product decision from a visual highlight, not
 * confirmed as the right threshold for raising an alert — flagged in the
 * report.
 */

export type AdminNotificationCategory =
  | "queue_stalled"
  | "editing_stalled"
  | "awaiting_review"
  | "report_open";

export type AdminNotification = {
  id: string;
  category: AdminNotificationCategory;
  title: string;
  description: string;
  missionId?: number;
  reportId?: number;
  since: string | null;
  ageDays: number;
  href: string;
};

export const QUEUE_STALL_DAYS = 3;
export const EDITING_STALL_DAYS = 5;

type QueueInput = { id: number; title: string; status: string; createdAt: string };
type FlightInput = { id: number; title: string; status: string; since: string | null };
type ReportInput = {
  id: number;
  missionId: number;
  missionTitle: string;
  status: string;
  createdAt: string;
};

function ageInDays(iso: string | null, now: Date): number {
  if (!iso) return 0;
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
}

export function buildAdminNotifications(
  input: { queue: QueueInput[]; inFlight: FlightInput[]; reports: ReportInput[] },
  now: Date = new Date(),
): AdminNotification[] {
  const notifications: AdminNotification[] = [];

  for (const item of input.queue) {
    if (item.status !== "available" && item.status !== "disponivel") continue;
    const days = ageInDays(item.createdAt, now);
    if (days < QUEUE_STALL_DAYS) continue;
    notifications.push({
      id: `queue_stalled:${item.id}`,
      category: "queue_stalled",
      title: `"${item.title}" está parada há ${days} dias sem editor`,
      description: "Nenhum editor disponível assumiu esta missão ainda.",
      missionId: item.id,
      since: item.createdAt,
      ageDays: days,
      href: "/inspetor/panorama",
    });
  }

  for (const mission of input.inFlight) {
    const days = ageInDays(mission.since, now);

    if (mission.status === "in_review" || mission.status === "em_revisao") {
      notifications.push({
        id: `awaiting_review:${mission.id}`,
        category: "awaiting_review",
        title: `"${mission.title}" está esperando revisão`,
        description: "O editor já entregou. Falta aprovar ou pedir reedição.",
        missionId: mission.id,
        since: mission.since,
        ageDays: days,
        href: "/inspetor",
      });
      continue;
    }

    const editorHoldsIt =
      mission.status === "reserved" ||
      mission.status === "reservada" ||
      mission.status === "revision_requested" ||
      mission.status === "reedicao" ||
      mission.status === "reedit";
    if (!editorHoldsIt || days < EDITING_STALL_DAYS) continue;
    notifications.push({
      id: `editing_stalled:${mission.id}`,
      category: "editing_stalled",
      title: `"${mission.title}" está parada há ${days} dias com o editor`,
      description: "O editor está com a missão reservada há dias sem entregar.",
      missionId: mission.id,
      since: mission.since,
      ageDays: days,
      href: "/inspetor/panorama",
    });
  }

  for (const report of input.reports) {
    if (report.status !== "open" && report.status !== "aberta") continue;
    notifications.push({
      id: `report_open:${report.id}`,
      category: "report_open",
      title: `Denúncia aberta em "${report.missionTitle}"`,
      description: "Aguardando decisão do inspetor.",
      missionId: report.missionId,
      reportId: report.id,
      since: report.createdAt,
      ageDays: ageInDays(report.createdAt, now),
      href: "/inspetor/denuncias",
    });
  }

  notifications.sort((a, b) => b.ageDays - a.ageDays);
  return notifications;
}
