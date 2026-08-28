import type { Role } from "@/lib/session";
import type { MissionStatus } from "@/lib/missions";

export type MissionAction =
  | "reserve"
  | "cancel"
  | "deliver"
  | "approve"
  | "revision"
  | "accept"
  | "adjust"
  | "message"
  | "report";

export function canPerformAction(
  status: string,
  role: Role,
  action: string
): boolean {
  if (action === "message" || action === "report" || action === "mensagem" || action === "denunciar") return true;

  if (action === "reserve" || action === "reservar") return role !== "spokesperson" && status === "available";
  if (action === "cancel" || action === "cancelar" || action === "deliver" || action === "entregar") {
    return role !== "spokesperson" && (status === "reserved" || status === "revision_requested");
  }
  if (action === "approve" || action === "aprovar") {
    return (role === "admin" || role === "spokesperson") && status === "in_review";
  }
  if (action === "revision" || action === "reedicao") return role === "admin" && status === "in_review";
  if (action === "accept" || action === "aceitar") return role !== "editor" && status === "approved";
  if (action === "adjust" || action === "ajuste") {
    return role !== "editor" && (status === "in_review" || status === "approved");
  }

  return false;
}

export const canExecuteAction = canPerformAction;
export const podeExecutarAcao = canPerformAction;
