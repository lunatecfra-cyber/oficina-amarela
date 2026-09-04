import type { UserSession } from "@oficina/auth/session";
import type { Report } from "@oficina/db/admin";
import { fetchApi, fetchApiJson } from "@/lib/internal-api";

export type { Report };
export type Denuncia = Report;

type ReportsResponse = {
  reports?: Report[];
  denuncias?: Report[];
  items?: Report[];
};

export function unwrapReportsResponse(value: unknown): Report[] {
  if (Array.isArray(value)) return value as Report[];
  if (!value || typeof value !== "object") return [];
  const envelope = value as ReportsResponse;
  if (Array.isArray(envelope.reports)) return envelope.reports;
  if (Array.isArray(envelope.denuncias)) return envelope.denuncias;
  if (Array.isArray(envelope.items)) return envelope.items;
  return [];
}

export async function createReport(
  missionId: number,
  _session: UserSession,
  rawText: string,
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const res = await fetchApi(`/missions/${missionId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "report", text: rawText, texto: rawText }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    erro?: string;
  };
  if (!res.ok || !body.ok) {
    const err = body.error ?? body.erro ?? "Erro ao enviar denúncia.";
    return { ok: false, error: err, erro: err };
  }
  return { ok: true };
}

export async function reportsForInspector(): Promise<Report[]> {
  const response = await fetchApiJson<ReportsResponse | Report[]>("/admin/reports");
  return unwrapReportsResponse(response);
}

export async function resolveReport(
  id: number,
  status: "resolved" | "ignored" | "resolvida" | "ignorada",
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const res = await fetchApi(`/admin/reports/${id}/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    erro?: string;
  };
  if (!res.ok || !body.ok) {
    const err = body.error ?? body.erro ?? "Erro ao resolver denúncia.";
    return { ok: false, error: err, erro: err };
  }
  return { ok: true };
}
