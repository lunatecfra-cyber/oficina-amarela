import { LIMITS, limitStr } from "@oficina/domain/limits";
import { sql } from "@/lib/db";
import type { Role, UserSession } from "@/lib/session";

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
  pauta_id: number;
  autor_id: number;
  nome: string;
  papel: string;
  texto: string;
  criada_em: string;
};

function rowToMessage(r: MessageRow): Message {
  const role: Role =
    r.papel === "voz" || r.papel === "spokesperson"
      ? "spokesperson"
      : r.papel === "admin"
        ? "admin"
        : "editor";
  return {
    id: `m-${r.id}`,
    missionId: r.pauta_id,
    authorId: r.autor_id,
    authorName: r.nome,
    authorRole: role,
    text: r.texto,
    createdAt: r.criada_em,
    pautaId: r.pauta_id,
    autorId: r.autor_id,
    autorNome: r.nome,
    autorPapel: role,
    texto: r.texto,
    criadaEm: r.criada_em,
  };
}

const BASE_SELECT = sql`
  SELECT m.id, m.pauta_id, m.autor_id, u.nome, u.papel, m.texto, m.criada_em
  FROM mensagens m
  JOIN users u ON u.id = m.autor_id
`;

export async function getMissionMessages(missionId: number): Promise<Message[]> {
  const rows = await sql`${BASE_SELECT}
    WHERE m.pauta_id = ${missionId}
    ORDER BY m.criada_em ASC
  `;
  return (rows as unknown as MessageRow[]).map(rowToMessage);
}

export const missionMessages = getMissionMessages;
export const messagesOfMission = getMissionMessages;
export const mensagensDaPauta = getMissionMessages;

export async function getMissionMessagesAfter(
  missionId: number,
  afterIso: string,
): Promise<Message[]> {
  const rows = await sql`${BASE_SELECT}
    WHERE m.pauta_id = ${missionId} AND m.criada_em > ${afterIso}
    ORDER BY m.criada_em ASC
  `;
  return (rows as unknown as MessageRow[]).map(rowToMessage);
}

export const messagesOfMissionAfter = getMissionMessagesAfter;
export const mensagensDaPautaApos = getMissionMessagesAfter;

export async function getMissionsMessages(missionIds: number[]): Promise<Map<number, Message[]>> {
  const map = new Map<number, Message[]>();
  if (missionIds.length === 0) return map;

  const rows = await sql`${BASE_SELECT}
    WHERE m.pauta_id = ANY(${missionIds})
    ORDER BY m.criada_em ASC
  `;
  for (const r of rows as unknown as MessageRow[]) {
    const arr = map.get(r.pauta_id) ?? [];
    arr.push(rowToMessage(r));
    map.set(r.pauta_id, arr);
  }
  return map;
}

export const missionsMessages = getMissionsMessages;
export const mensagensDePautas = getMissionsMessages;

export async function postChatMessage(
  missionId: number,
  session: UserSession,
  rawText: string,
): Promise<
  { ok: true; message: Message; mensagem?: Message } | { ok: false; error: string; erro?: string }
> {
  const text = limitStr(rawText, LIMITS.message);
  if (!text) {
    return { ok: false, error: "Mensagem vazia.", erro: "Mensagem vazia." };
  }

  const [pauta] = await sql`
    SELECT id, porta_voz_id, reservada_por_id FROM pautas WHERE id = ${missionId}
  `;
  if (!pauta) {
    return { ok: false, error: "Missão não encontrada.", erro: "Missão não encontrada." };
  }

  const isAdmin = session.role === "admin";
  const isSpokesperson = pauta.porta_voz_id === session.id;
  const isReservedEditor = pauta.reservada_por_id === session.id;

  if (!isAdmin && !isSpokesperson && !isReservedEditor) {
    return {
      ok: false,
      error: "Você não tem permissão para enviar mensagens nesta missão.",
      erro: "Você não tem permissão para enviar mensagens nesta missão.",
    };
  }

  const [inserted] = await sql`
    INSERT INTO mensagens (pauta_id, autor_id, texto)
    VALUES (${missionId}, ${session.id}, ${text})
    RETURNING id, pauta_id, autor_id, texto, criada_em
  `;

  const msg: Message = {
    id: `m-${inserted.id}`,
    missionId: inserted.pauta_id,
    authorId: inserted.autor_id,
    authorName: session.name,
    authorRole: session.role,
    text: inserted.texto,
    createdAt: inserted.criada_em,
    pautaId: inserted.pauta_id,
    autorId: inserted.autor_id,
    autorNome: session.name,
    autorPapel: session.role,
    texto: inserted.texto,
    criadaEm: inserted.criada_em,
  };

  return { ok: true, message: msg, mensagem: msg };
}

export const sendMessage = postChatMessage;
export const postarMensagem = postChatMessage;
export const enviarMensagem = postChatMessage;
