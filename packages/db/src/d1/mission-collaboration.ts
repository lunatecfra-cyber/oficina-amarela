import { LIMITS, limitStr } from "@oficina/domain/limits";
import type { Role } from "@oficina/domain/roles";
import type {
  MissionActor,
  MissionCollaborationRepository,
  MissionMessage,
} from "../mission-collaboration.ts";
import type { D1DatabaseLike } from "./types.ts";

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

export function createD1MissionCollaboration(db: D1DatabaseLike): MissionCollaborationRepository {
  async function participant(missionId: number, actor: Pick<MissionActor, "id" | "role">) {
    const mission = await db
      .prepare("SELECT porta_voz_id, reservada_por_id FROM pautas WHERE id = ?")
      .bind(missionId)
      .first<{ porta_voz_id: number; reservada_por_id: number | null }>();
    if (!mission) return { ok: false as const, reason: "mission_not_found" as const };
    if (
      actor.role !== "admin" &&
      actor.id !== mission.porta_voz_id &&
      actor.id !== mission.reservada_por_id
    ) {
      return { ok: false as const, reason: "forbidden" as const };
    }
    return { ok: true as const, mission };
  }

  return {
    async messagesForMission(missionId, actor, after) {
      const access = await participant(missionId, actor);
      if (!access.ok) return access;
      const query = after
        ? `SELECT m.id, m.pauta_id, m.autor_id, u.nome, u.papel, m.texto, m.criada_em
           FROM mensagens m JOIN users u ON u.id = m.autor_id
           WHERE m.pauta_id = ? AND m.criada_em > ? ORDER BY m.criada_em ASC, m.id ASC`
        : `SELECT m.id, m.pauta_id, m.autor_id, u.nome, u.papel, m.texto, m.criada_em
           FROM mensagens m JOIN users u ON u.id = m.autor_id
           WHERE m.pauta_id = ? ORDER BY m.criada_em ASC, m.id ASC`;
      const statement = db.prepare(query);
      const rows = await (after
        ? statement.bind(missionId, after)
        : statement.bind(missionId)
      ).all<MessageRow>();
      return { ok: true, messages: rows.results.map(rowToMessage) };
    },

    async sendMessage(missionId, actor, rawText) {
      const text = limitStr(rawText, LIMITS.message);
      if (!text) return { ok: false, reason: "empty_message" };
      const access = await participant(missionId, actor);
      if (!access.ok) return access;
      const row = await db
        .prepare(
          `INSERT INTO mensagens (pauta_id, autor_id, texto) VALUES (?, ?, ?)
           RETURNING id, pauta_id, autor_id, texto, criada_em`,
        )
        .bind(missionId, actor.id, text)
        .first<Omit<MessageRow, "nome" | "papel">>();
      return {
        ok: true,
        message: rowToMessage({ ...row, nome: actor.name, papel: actor.role } as MessageRow),
      };
    },

    async reportMission(missionId, actor, rawText) {
      const text = limitStr(rawText, LIMITS.report);
      if (!text) return { ok: false, reason: "empty_report" };
      const access = await participant(missionId, actor);
      if (!access.ok) return access;
      const reportedId =
        actor.id === access.mission.porta_voz_id
          ? access.mission.reservada_por_id
          : access.mission.porta_voz_id;
      await db
        .prepare(
          "INSERT INTO denuncias (pauta_id, denunciante_id, denunciado_id, texto) VALUES (?, ?, ?, ?)",
        )
        .bind(missionId, actor.id, reportedId, text)
        .run();
      return { ok: true };
    },
  };
}
