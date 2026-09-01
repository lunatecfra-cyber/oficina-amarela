import type { CreateMissionInput } from "@oficina/db/missions";
import type { Mission } from "@oficina/domain/missions";
import { fetchApi, fetchApiJson } from "@/lib/internal-api";

export type { CreateMissionInput, MissionRow } from "@oficina/db/missions";

export async function createMission(
  data: CreateMissionInput,
): Promise<{ ok: true; id: number } | { ok: false; error: string; erro?: string }> {
  const res = await fetchApi("/missions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    id?: number;
    error?: string;
    erro?: string;
  };
  if (!res.ok || !body.ok) {
    const err = body.error ?? body.erro ?? "Erro ao criar missão.";
    return { ok: false, error: err, erro: err };
  }
  return { ok: true, id: Number(body.id) };
}

export async function getSpokespersonMissions(_spokespersonId?: number): Promise<Mission[]> {
  const list = await fetchApiJson<Mission[]>("/missions/spokesperson");
  return list ?? [];
}

export async function getSpokespersonMissionById(
  id: number,
  _spokespersonId?: number,
): Promise<Mission | null> {
  return fetchApiJson<Mission>(`/missions/spokesperson/${id}`);
}

export async function getQueuePosition(missionId: number): Promise<number> {
  const data = await fetchApiJson<{ position: number }>(`/missions/${missionId}/queue-position`);
  return data?.position ?? 0;
}

export async function getTotalInQueue(): Promise<number> {
  const data = await fetchApiJson<{ total: number }>("/missions/queue-total");
  return data?.total ?? 0;
}

export async function getAvailableMissions(): Promise<Mission[]> {
  const list = await fetchApiJson<Mission[]>("/missions/available");
  return list ?? [];
}

export async function getReservedMission(_editorId?: number): Promise<Mission | null> {
  return fetchApiJson<Mission>("/editor/active-mission");
}

export async function getApprovedDeliveries(_editorId?: number): Promise<Mission[]> {
  const list = await fetchApiJson<Mission[]>("/editor/deliveries");
  return list ?? [];
}

export async function getPublicCandidateMissions(handle: string): Promise<Mission[]> {
  const list = await fetchApiJson<Mission[]>(`/candidates/${handle}/missions`);
  return list ?? [];
}

export async function getMissionsInReview(): Promise<Mission[]> {
  const list = await fetchApiJson<Mission[]>("/missions/in-review");
  return list ?? [];
}

export async function getMissionById(id: number): Promise<Mission | null> {
  return fetchApiJson<Mission>(`/missions/view/${id}`);
}

export async function approveMission(
  missionId: number,
  _approvedById: number,
  rating?: number,
  comment?: string,
  _spokespersonId?: number,
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const res = await fetchApi(`/missions/${missionId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "approve",
      rating,
      comment,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    erro?: string;
  };
  if (!res.ok || !body.ok) {
    const err = body.error ?? body.erro ?? "Erro ao aprovar missão.";
    return { ok: false, error: err, erro: err };
  }
  return { ok: true };
}

export async function deleteMission(
  missionId: number,
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const res = await fetchApi(`/missions/${missionId}`, { method: "DELETE" });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    erro?: string;
  };
  if (!res.ok || !body.ok) {
    const err = body.error ?? body.erro ?? "Erro ao apagar missão.";
    return { ok: false, error: err, erro: err };
  }
  return { ok: true };
}

export async function listAllMissions(): Promise<Mission[]> {
  const list = await fetchApiJson<Mission[]>("/admin/missions");
  return list ?? [];
}
