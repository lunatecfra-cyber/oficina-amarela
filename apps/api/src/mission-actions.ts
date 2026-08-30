export type MigratedMissionAction =
  | "reserve"
  | "cancel"
  | "deliver"
  | "re_edit"
  | "accept"
  | "adjust";

const MIGRATED_ACTIONS: Record<string, MigratedMissionAction> = {
  reserve: "reserve",
  reservar: "reserve",
  cancel: "cancel",
  cancelar: "cancel",
  deliver: "deliver",
  entregar: "deliver",
  re_edit: "re_edit",
  reedicao: "re_edit",
  accept: "accept",
  aceitar: "accept",
  adjust: "adjust",
  ajuste: "adjust",
};

export function migratedMissionAction(rawAction: unknown): MigratedMissionAction | null {
  return typeof rawAction === "string" ? (MIGRATED_ACTIONS[rawAction] ?? null) : null;
}
