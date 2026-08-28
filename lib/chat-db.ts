import { sql } from "@/lib/db";
import { LIMITS, limitStr } from "@/lib/limits";
import type { UserSession, Role } from "@/lib/session";

export type Message = {
  id: string;
  missionId: number;
  authorId: number;
  authorName: string;
  authorRole: Role;
  text: string;
  createdAt: string;
  // compatibility aliases
  pautaId?: number;
  autorId?: number;
  autorNome?: string;
  autorPapel?: Role;
  texto?: string;
  criadaEm?: string;
};

export type Mensagem = Message;
export type ChatMessage = Message;

type MessageRow = {
  id: number;
  mission_id: number;
  author_id: number;
  name: string;
  role: string;
  text: string;
  created_at: string;
};

function rowToMessage(r: MessageRow): Message {
  const role: Role = r.role === "voz" || r.role === "spokesperson" ? "spokesperson" : r.role === "admin" ? "admin" : "editor";
  return {
    id: `m-${r.id}`,
    missionId: r.mission_id,
    authorId: r.author_id,
    authorName: r.name,
    authorRole: role,
    text: r.text,
    createdAt: r.created_at,
    pautaId: r.mission_id,
    autorId: r.author_id,
    autorNome: r.name,
    autorPapel: role,
    texto: r.text,
    criadaEm: r.created_at,
  };
}

const BASE_SELECT = sql`
  SELECT m.id, m.mission_id, m.author_id, u.name, u.role, m.text, m.created_at
  FROM messages m
  JOIN users u ON u.id = m.author_id
`;

export async function getMissionMessages(missionId: number): Promise<Message[]> {
  const rows = await sql`${BASE_SELECT}
    WHERE m.mission_id = ${missionId}
    ORDER BY m.created_at ASC
  `;
  return (rows as unknown as MessageRow[]).map(rowToMessage);
}

export const missionMessages = getMissionMessages;
export const messagesOfMission = getMissionMessages;
export const mensagensDaPauta = getMissionMessages;

export async function getMissionMessagesAfter(missionId: number, afterIso: string): Promise<Message[]> {
  const rows = await sql`${BASE_SELECT}
    WHERE m.mission_id = ${missionId} AND m.created_at > ${afterIso}
    ORDER BY m.created_at ASC
  `;
  return (rows as unknown as MessageRow[]).map(rowToMessage);
}

export const messagesOfMissionAfter = getMissionMessagesAfter;
export const mensagensDaPautaApos = getMissionMessagesAfter;

export async function getMissionsMessages(
  missionIds: number[]
): Promise<Map<number, Message[]>> {
  const map = new Map<number, Message[]>();
  if (missionIds.length === 0) return map;

  const rows = await sql`${BASE_SELECT}
    WHERE m.mission_id = ANY(${missionIds})
    ORDER BY m.created_at ASC
  `;
  for (const r of rows as unknown as MessageRow[]) {
    const arr = map.get(r.mission_id) ?? [];
    arr.push(rowToMessage(r));
    map.set(r.mission_id, arr);
  }
  return map;
}

export const missionsMessages = getMissionsMessages;
export const mensagensDePautas = getMissionsMessages;

export async function postChatMessage(
  missionId: number,
  session: UserSession,
  rawText: string
): Promise<{ ok: true; message: Message; mensagem?: Message } | { ok: false; error: string; erro?: string }> {
  const text = limitStr(rawText, LIMITS.message);
  if (!text) {
    return { ok: false, error: "Mensagem vazia.", erro: "Mensagem vazia." };
  }

  const [pauta] = await sql`
    SELECT id, spokesperson_id, reserved_by_id FROM missions WHERE id = ${missionId}
  `;
  if (!pauta) {
    return { ok: false, error: "Missão não encontrada.", erro: "Missão não encontrada." };
  }

  const isAdmin = session.role === "admin";
  const isSpokesperson = pauta.spokesperson_id === session.id;
  const isReservedEditor = pauta.reserved_by_id === session.id;

  if (!isAdmin && !isSpokesperson && !isReservedEditor) {
    return {
      ok: false,
      error: "Você não tem permissão para enviar mensagens nesta missão.",
      erro: "Você não tem permissão para enviar mensagens nesta missão.",
    };
  }

  const [inserted] = await sql`
    INSERT INTO messages (mission_id, author_id, text)
    VALUES (${missionId}, ${session.id}, ${text})
    RETURNING id, mission_id, author_id, text, created_at
  `;

  const msg: Message = {
    id: `m-${inserted.id}`,
    missionId: inserted.mission_id,
    authorId: inserted.author_id,
    authorName: session.name,
    authorRole: session.role,
    text: inserted.text,
    createdAt: inserted.created_at,
    pautaId: inserted.mission_id,
    autorId: inserted.author_id,
    autorNome: session.name,
    autorPapel: session.role,
    texto: inserted.text,
    criadaEm: inserted.created_at,
  };

  return { ok: true, message: msg, mensagem: msg };
}

export const sendMessage = postChatMessage;
export const postarMensagem = postChatMessage;
export const enviarMensagem = postChatMessage;
