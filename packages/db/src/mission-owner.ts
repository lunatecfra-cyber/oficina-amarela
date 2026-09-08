export type OwnerAction = "cancel_mission" | "reassign_mission";
export type OwnerFailure =
  | "mission_not_found"
  | "forbidden"
  | "conflict"
  | "invalid_reason"
  | "invalid_request";
export type OwnerControls = {
  canCancel: boolean;
  canReassign: boolean;
  reassignAvailableAt: string | null;
  cancelled: boolean;
  version: number;
};
export type OwnerControlsResult =
  | { ok: true; controls: OwnerControls }
  | { ok: false; reason: OwnerFailure };
export type OwnerActionResult = { ok: true } | { ok: false; reason: OwnerFailure };
export type OwnerActionInput = {
  missionId: number;
  actorId: number;
  action: OwnerAction;
  reason: string;
  requestId: string;
  version: number;
};
export type OwnerNotification = {
  id: string;
  missionId: number;
  action: string;
  reason: string;
  createdAt: string;
};
export interface MissionOwnerRepository {
  controls(missionId: number, actorId: number): Promise<OwnerControlsResult>;
  act(input: OwnerActionInput): Promise<OwnerActionResult>;
  notifications(actorId: number): Promise<OwnerNotification[]>;
}

export function validateOwnerAction(input: OwnerActionInput): OwnerFailure | null {
  if (
    typeof input.reason !== "string" ||
    input.reason.trim().length < 5 ||
    input.reason.trim().length > 500
  )
    return "invalid_reason";
  if (
    !/^[a-zA-Z0-9_-]{16,100}$/.test(input.requestId) ||
    !Number.isSafeInteger(input.version) ||
    input.version < 0 ||
    !["cancel_mission", "reassign_mission"].includes(input.action)
  )
    return "invalid_request";
  return null;
}

export function ownerControls(
  row: {
    status: string;
    reserved_at: string | null;
    first_delivered_at: string | null;
    lifecycle_version: number;
  },
  now = Date.now(),
): OwnerControls {
  const canCancel =
    !row.first_delivered_at && ["disponivel", "oferecida", "reservada"].includes(row.status);
  const accepted = row.reserved_at ? Date.parse(row.reserved_at) : NaN;
  const available = Number.isFinite(accepted) ? accepted + 48 * 60 * 60 * 1000 : NaN;
  return {
    canCancel,
    canReassign: canCancel && row.status === "reservada" && available <= now,
    reassignAvailableAt:
      canCancel && row.status === "reservada" && Number.isFinite(available)
        ? new Date(available).toISOString()
        : null,
    cancelled: row.status === "cancelada",
    version: row.lifecycle_version,
  };
}
