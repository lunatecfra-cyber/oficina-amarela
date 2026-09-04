import { LIMITS, limitStr } from "@oficina/domain/limits";
import type { Role } from "@oficina/domain/roles";
import { sql } from "./client.ts";

export type MissionActor = { id: number; name: string; role: Role };

export type MissionMessage = {
  id: string;
  missionId: number;
  authorId: number;
  authorName: string;
  authorRole: Role;
  text: string;
  createdAt: string;
  pautaId?: number;
  autorId?: number;
  autorNome?: string;
  autorPapel?: Role;
  texto?: string;
  criadaEm?: string;
};
export type Message = MissionMessage;
export type Mensagem = MissionMessage;
export type ChatMessage = MissionMessage;

export type MissionCollaborationFailure =
  | "mission_not_found"
  | "forbidden"
  | "empty_message"
  | "empty_report"
  | "write_failed";

export type MissionMessagesByMissionResult =
  | { ok: true; messages: Record<number, MissionMessage[]> }
  | { ok: false; reason: MissionCollaborationFailure };

export type MissionMessagesResult =
  | { ok: true; messages: MissionMessage[] }
  | { ok: false; reason: MissionCollaborationFailure };
export type MissionMessageResult =
  | { ok: true; message: MissionMessage }
  | { ok: false; reason: MissionCollaborationFailure };
export type MissionReportResult = { ok: true } | { ok: false; reason: MissionCollaborationFailure };

export interface MissionCollaborationRepository {
  messagesForMission(
    missionId: number,
    actor: Pick<MissionActor, "id" | "role">,
    after?: string,
  ): Promise<MissionMessagesResult>;
  /**
   * Mensagens de várias missões de uma vez. Só o inspetor usa, no painel: em
   * requisição por missão isso vira N+1 na página que mais carrega dados.
   */
  messagesForMissions(
    missionIds: number[],
    actor: Pick<MissionActor, "id" | "role">,
  ): Promise<MissionMessagesByMissionResult>;
  sendMessage(missionId: number, actor: MissionActor, text: string): Promise<MissionMessageResult>;
  reportMission(
    missionId: number,
    actor: Pick<MissionActor, "id" | "role">,
    text: string,
  ): Promise<MissionReportResult>;
}

type MessageRow = {
  id: number;
  pauta_id: number;
  autor_id: number;
  nome: string;
  papel: string;
  texto: string;
  criada_em: string;
};

function rowToMessage(row: MessageRow): MissionMessage {
  const role: Role =
    row.papel === "voz" || row.papel === "spokesperson"
      ? "spokesperson"
      : row.papel === "admin"
        ? "admin"
        : "editor";
  return {
    id: `m-${row.id}`,
    missionId: row.pauta_id,
    authorId: row.autor_id,
    authorName: row.nome,
    authorRole: role,
    text: row.texto,
    createdAt: row.criada_em,
    pautaId: row.pauta_id,
    autorId: row.autor_id,
    autorNome: row.nome,
    autorPapel: role,
    texto: row.texto,
    criadaEm: row.criada_em,
  };
}

async function participant(
  missionId: number,
  actor: Pick<MissionActor, "id" | "role">,
): Promise<
  | { ok: true; spokespersonId: number; editorId: number | null }
  | { ok: false; reason: "mission_not_found" | "forbidden" }
> {
  const [mission] = await sql`
    SELECT porta_voz_id, reservada_por_id FROM pautas WHERE id = ${missionId}
  `;
  if (!mission) return { ok: false, reason: "mission_not_found" };
  if (
    actor.role !== "admin" &&
    mission.porta_voz_id !== actor.id &&
    mission.reservada_por_id !== actor.id
  ) {
    return { ok: false, reason: "forbidden" };
  }
  return {
    ok: true,
    spokespersonId: mission.porta_voz_id as number,
    editorId: (mission.reservada_por_id as number | null) ?? null,
  };
}

export const postgresMissionCollaboration: MissionCollaborationRepository = {
  async messagesForMission(missionId, actor, after) {
    const access = await participant(missionId, actor);
    if (!access.ok) return access;
    const rows = after
      ? await sql`
          SELECT m.id, m.pauta_id, m.autor_id, u.nome, u.papel, m.texto, m.criada_em
          FROM mensagens m JOIN users u ON u.id = m.autor_id
          WHERE m.pauta_id = ${missionId}
            AND m.criada_em >= ${after}::timestamptz + interval '1 millisecond'
          ORDER BY m.criada_em ASC`
      : await sql`
          SELECT m.id, m.pauta_id, m.autor_id, u.nome, u.papel, m.texto, m.criada_em
          FROM mensagens m JOIN users u ON u.id = m.autor_id
          WHERE m.pauta_id = ${missionId}
          ORDER BY m.criada_em ASC`;
    return { ok: true, messages: (rows as unknown as MessageRow[]).map(rowToMessage) };
  },

  async messagesForMissions(missionIds, actor) {
    if (actor.role !== "admin") return { ok: false, reason: "forbidden" };
    const messages: Record<number, MissionMessage[]> = {};
    if (missionIds.length === 0) return { ok: true, messages };

    const rows = await sql`
      SELECT m.id, m.pauta_id, m.autor_id, u.nome, u.papel, m.texto, m.criada_em
      FROM mensagens m JOIN users u ON u.id = m.autor_id
      WHERE m.pauta_id = ANY(${missionIds})
      ORDER BY m.criada_em ASC, m.id ASC`;
    for (const row of rows as unknown as MessageRow[]) {
      if (!messages[row.pauta_id]) {
        messages[row.pauta_id] = [];
      }
      messages[row.pauta_id].push(rowToMessage(row));
    }
    return { ok: true, messages };
  },

  async sendMessage(missionId, actor, rawText) {
    const text = limitStr(rawText, LIMITS.message);
    if (!text) return { ok: false, reason: "empty_message" };
    const access = await participant(missionId, actor);
    if (!access.ok) return access;

    const [inserted] = await sql`
      INSERT INTO mensagens (pauta_id, autor_id, texto)
      VALUES (${missionId}, ${actor.id}, ${text})
      RETURNING id, pauta_id, autor_id, texto, criada_em
    `;
    if (!inserted) return { ok: false, reason: "write_failed" };
    return {
      ok: true,
      message: rowToMessage({
        ...inserted,
        nome: actor.name,
        papel: actor.role,
      } as MessageRow),
    };
  },

  async reportMission(missionId, actor, rawText) {
    const text = limitStr(rawText, LIMITS.report);
    if (!text) return { ok: false, reason: "empty_report" };
    const access = await participant(missionId, actor);
    if (!access.ok) return access;
    const reportedId = actor.id === access.spokespersonId ? access.editorId : access.spokespersonId;
    await sql`
      INSERT INTO denuncias (pauta_id, denunciante_id, denunciado_id, texto)
      VALUES (${missionId}, ${actor.id}, ${reportedId}, ${text})
    `;
    return { ok: true };
  },
};

export async function getMissionMessages(missionId: number): Promise<MissionMessage[]> {
  const rows = await sql`
    SELECT m.id, m.pauta_id, m.autor_id, u.nome, u.papel, m.texto, m.criada_em
    FROM mensagens m JOIN users u ON u.id = m.autor_id
    WHERE m.pauta_id = ${missionId}
    ORDER BY m.criada_em ASC`;
  return (rows as unknown as MessageRow[]).map(rowToMessage);
}

export async function getMissionMessagesAfter(
  missionId: number,
  after: string,
): Promise<MissionMessage[]> {
  const rows = await sql`
    SELECT m.id, m.pauta_id, m.autor_id, u.nome, u.papel, m.texto, m.criada_em
    FROM mensagens m JOIN users u ON u.id = m.autor_id
    WHERE m.pauta_id = ${missionId}
      AND m.criada_em >= ${after}::timestamptz + interval '1 millisecond'
    ORDER BY m.criada_em ASC`;
  return (rows as unknown as MessageRow[]).map(rowToMessage);
}

export async function getMissionsMessages(
  missionIds: number[],
): Promise<Map<number, MissionMessage[]>> {
  const messages = new Map<number, MissionMessage[]>();
  if (missionIds.length === 0) return messages;
  const rows = await sql`
    SELECT m.id, m.pauta_id, m.autor_id, u.nome, u.papel, m.texto, m.criada_em
    FROM mensagens m JOIN users u ON u.id = m.autor_id
    WHERE m.pauta_id = ANY(${missionIds})
    ORDER BY m.criada_em ASC`;
  for (const row of rows as unknown as MessageRow[]) {
    const missionMessages = messages.get(row.pauta_id) ?? [];
    missionMessages.push(rowToMessage(row));
    messages.set(row.pauta_id, missionMessages);
  }
  return messages;
}

export async function postChatMessage(
  missionId: number,
  actor: MissionActor,
  text: string,
): Promise<
  | { ok: true; message: MissionMessage; mensagem: MissionMessage }
  | { ok: false; error: string; erro: string }
> {
  const result = await postgresMissionCollaboration.sendMessage(missionId, actor, text);
  if (result.ok) return { ...result, mensagem: result.message };
  const error =
    result.reason === "mission_not_found"
      ? "Missão não encontrada."
      : result.reason === "forbidden"
        ? "Você não tem permissão para enviar mensagens nesta missão."
        : "Mensagem vazia.";
  return { ok: false, error, erro: error };
}
