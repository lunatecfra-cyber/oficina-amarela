import type {
  ChatMessage,
  Mensagem,
  Message,
  MissionMessage,
} from "@oficina/db/mission-collaboration";
import { fetchApi, fetchApiJson } from "@/lib/internal-api";

/**
 * Cliente do chat de missão.
 *
 * Antes este módulo reexportava as funções do pacote de banco, o que deixava as
 * páginas do Next falando com PostgreSQL direto — o último caminho híbrido do
 * apps/web. Agora tudo passa pela API por Service Binding.
 */

export type { ChatMessage, Mensagem, Message, MissionMessage };

export async function getMissionMessages(missionId: number): Promise<MissionMessage[]> {
  const body = await fetchApiJson<{ messages: MissionMessage[] }>(`/missions/${missionId}`);
  return body?.messages ?? [];
}

export async function getMissionMessagesAfter(
  missionId: number,
  after: string,
): Promise<MissionMessage[]> {
  const body = await fetchApiJson<{ messages: MissionMessage[] }>(
    `/missions/${missionId}?after=${encodeURIComponent(after)}`,
  );
  return body?.messages ?? [];
}

export async function getMissionsMessages(
  missionIds: number[],
): Promise<Map<number, MissionMessage[]>> {
  const messages = new Map<number, MissionMessage[]>();
  if (missionIds.length === 0) return messages;

  const body = await fetchApiJson<{ messages: Record<string, MissionMessage[]> }>(
    `/missions/messages?ids=${missionIds.join(",")}`,
  );
  for (const [missionId, list] of Object.entries(body?.messages ?? {})) {
    messages.set(Number(missionId), list);
  }
  return messages;
}

export async function postChatMessage(
  missionId: number,
  _authorId: number,
  text: string,
): Promise<MissionMessage | null> {
  const res = await fetchApi(`/missions/${missionId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "message", text }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { message?: MissionMessage };
  return body.message ?? null;
}
