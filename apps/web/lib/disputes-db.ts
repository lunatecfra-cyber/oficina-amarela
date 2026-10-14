import type { DisputeCase, DisputeSummary } from "@oficina/db/disputes";
import { fetchApiJson } from "@/lib/internal-api";

export type { DisputeCase, DisputeSummary };

export const DISPUTE_STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  in_review: "Em análise",
  decided: "Decidida",
  appealed: "Em recurso",
  closed: "Encerrada",
};
export const DISPUTE_CATEGORY_LABEL: Record<string, string> = {
  quality: "Qualidade da entrega",
  deadline: "Prazo",
  scope: "Escopo do briefing",
  conduct: "Conduta",
  other: "Outro",
};
export const DISPUTE_OUTCOME_LABEL: Record<string, string> = {
  upheld: "Procedente",
  partially_upheld: "Parcialmente procedente",
  dismissed: "Improcedente",
};

export async function listDisputes(): Promise<DisputeSummary[]> {
  const body = await fetchApiJson<{ disputes: DisputeSummary[] }>("/disputes");
  return body?.disputes ?? [];
}

export async function getDispute(id: number): Promise<DisputeCase | null> {
  const body = await fetchApiJson<{ dispute: DisputeCase }>(`/disputes/${id}`);
  return body?.dispute ?? null;
}
