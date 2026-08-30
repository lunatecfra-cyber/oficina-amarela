import type { UserSession } from "@oficina/auth/session";
import type { Report } from "@oficina/db/admin";
import { fetchApi, fetchApiJson } from "@/lib/internal-api";

export type { Report };
export type Denuncia = Report;

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
export const criarDenuncia = createReport;
export const createModerationReport = createReport;

export async function reportsForInspector(): Promise<Report[]> {
  const reports = await fetchApiJson<Report[]>("/admin/reports");
  return reports ?? [];
}
export const denunciasParaInspetor = reportsForInspector;

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
export const resolverDenuncia = resolveReport;
export const resolveModerationReport = resolveReport;
