import type { MissionInFlight, QueueItem, QueueMove, SystemOverview } from "@oficina/db/admin";
import { fetchApi, fetchApiJson } from "@/lib/internal-api";

export type { MissionInFlight, QueueItem, QueueMove, SystemOverview };
export type Summary = SystemOverview;
export type Resumo = SystemOverview;
export type ItemFila = QueueItem;
export type MissaoEmVoo = MissionInFlight;
export type Movimento = QueueMove;
export type QueueMovement = QueueMove;

export async function getSystemOverview(): Promise<SystemOverview> {
  const data = await fetchApiJson<SystemOverview>("/admin/overview");
  return (
    data ?? {
      inQueue: 0,
      offered: 0,
      inEditing: 0,
      inReview: 0,
      inRevision: 0,
      inReedit: 0,
      completed: 0,
      spokespersons: 0,
      candidates: 0,
      editors: 0,
      freeEditors: 0,
      banned: 0,
      naFila: 0,
      oferecidas: 0,
      emEdicao: 0,
      emConferencia: 0,
      emReedicao: 0,
      concluidas: 0,
      candidatos: 0,
      editores: 0,
      editoresLivres: 0,
      banidos: 0,
    }
  );
}

export async function getEditingQueue(): Promise<QueueItem[]> {
  const data = await fetchApiJson<QueueItem[]>("/admin/queue");
  return data ?? [];
}

export async function getMissionsInFlight(): Promise<MissionInFlight[]> {
  const data = await fetchApiJson<MissionInFlight[]>("/admin/in-flight");
  return data ?? [];
}

export async function moveInQueue(
  missionId: number,
  movement: QueueMove,
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const res = await fetchApi("/admin/queue/move", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ missionId, movement }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    erro?: string;
  };
  if (!res.ok || !body.ok) {
    const err = body.error ?? body.erro ?? "Erro ao mover missão na fila.";
    return { ok: false, error: err, erro: err };
  }
  return { ok: true };
}

export async function getActiveEditorEmails(): Promise<
  { name: string; email: string; nome?: string }[]
> {
  const data = await fetchApiJson<{ editors: { name: string; email: string }[] }>(
    "/admin/broadcast/recipients?audience=editors",
  );
  return data?.editors ?? [];
}

export async function getActiveSpokespersonEmails(): Promise<
  { name: string; email: string; nome?: string }[]
> {
  const data = await fetchApiJson<{ spokespersons: { name: string; email: string }[] }>(
    "/admin/broadcast/recipients?audience=spokespersons",
  );
  return data?.spokespersons ?? [];
}
