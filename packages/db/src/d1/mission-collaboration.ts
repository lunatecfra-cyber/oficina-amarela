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
  mission_id?: number;
  author_id?: number;
  name?: string;
  role?: string;
  body?: string;
  created_at?: string;

  pauta_id?: number;
  autor_id?: number;
  nome?: string;
  papel?: string;
  texto?: string;
  criada_em?: string;
};

function rowToMessage(row: MessageRow): MissionMessage {
  const rawRole = row.role ?? row.papel;
  const role: Role =
    rawRole === "voz" || rawRole === "spokesperson"
      ? "spokesperson"
      : rawRole === "admin"
        ? "admin"
        : "editor";
  const missionId = row.mission_id ?? row.pauta_id ?? 0;
  const authorId = row.author_id ?? row.autor_id ?? 0;
  const authorName = row.name ?? row.nome ?? "";
  const text = row.body ?? row.texto ?? "";
  const createdAt = row.created_at ?? row.criada_em ?? "";

  return {
    id: `m-${row.id}`,
    missionId,
    authorId,
    authorName,
    authorRole: role,
    text,
    createdAt,
    pautaId: missionId,
    autorId: authorId,
    autorNome: authorName,
    autorPapel: role,
    texto: text,
    criadaEm: createdAt,
  };
}

export function createD1MissionCollaboration(db: D1DatabaseLike): MissionCollaborationRepository {
  async function participant(missionId: number, actor: Pick<MissionActor, "id" | "role">) {
    const mission = await db
      .prepare("SELECT spokesperson_id, reserved_by_id FROM missions WHERE id = ?")
      .bind(missionId)
      .first<{ spokesperson_id: number; reserved_by_id: number | null }>();
    if (!mission) return { ok: false as const, reason: "mission_not_found" as const };
    if (
      actor.role !== "admin" &&
      actor.id !== mission.spokesperson_id &&
      actor.id !== mission.reserved_by_id
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
        ? `SELECT m.id, m.mission_id, m.author_id, u.name, u.role, m.body, m.created_at
           FROM messages m JOIN users u ON u.id = m.author_id
           WHERE m.mission_id = ? AND m.created_at > ? ORDER BY m.created_at ASC, m.id ASC`
        : `SELECT m.id, m.mission_id, m.author_id, u.name, u.role, m.body, m.created_at
           FROM messages m JOIN users u ON u.id = m.author_id
           WHERE m.mission_id = ? ORDER BY m.created_at ASC, m.id ASC`;
      const statement = db.prepare(query);
      const rows = await (after
        ? statement.bind(missionId, after)
        : statement.bind(missionId)
      ).all<MessageRow>();
      return { ok: true, messages: rows.results.map(rowToMessage) };
    },

    async messagesForMissions(missionIds, actor) {
      if (actor.role !== "admin") return { ok: false, reason: "forbidden" as const };
      const messages: Record<number, MissionMessage[]> = {};
      if (missionIds.length === 0) return { ok: true as const, messages };

      // D1 aceita no máximo 100 parâmetros por consulta; o painel do inspetor
      // pode passar mais missões que isso.
      const CHUNK = 50;
      for (let start = 0; start < missionIds.length; start += CHUNK) {
        const chunk = missionIds.slice(start, start + CHUNK);
        const placeholders = chunk.map(() => "?").join(", ");
        const rows = await db
          .prepare(
            `SELECT m.id, m.mission_id, m.author_id, u.name, u.role, m.body, m.created_at
             FROM messages m JOIN users u ON u.id = m.author_id
             WHERE m.mission_id IN (${placeholders})
             ORDER BY m.created_at ASC, m.id ASC`,
          )
          .bind(...chunk)
          .all<MessageRow>();
        for (const row of rows.results) {
          const mid = row.mission_id ?? row.pauta_id ?? 0;
          if (!messages[mid]) {
            messages[mid] = [];
          }
          messages[mid].push(rowToMessage(row));
        }
      }
      return { ok: true as const, messages };
    },

    async sendMessage(missionId, actor, rawText) {
      const text = limitStr(rawText, LIMITS.message);
      if (!text) return { ok: false, reason: "empty_message" };
      const access = await participant(missionId, actor);
      if (!access.ok) return access;
      const row = await db
        .prepare(
          `INSERT INTO messages (mission_id, author_id, body) VALUES (?, ?, ?)
           RETURNING id, mission_id, author_id, body, created_at`,
        )
        .bind(missionId, actor.id, text)
        .first<Omit<MessageRow, "name" | "role">>();
      return {
        ok: true,
        message: rowToMessage({ ...row, name: actor.name, role: actor.role } as MessageRow),
      };
    },

    async reportMission(missionId, actor, rawText) {
      const text = limitStr(rawText, LIMITS.report);
      if (!text) return { ok: false, reason: "empty_report" };
      const access = await participant(missionId, actor);
      if (!access.ok) return access;
      const reportedId =
        actor.id === access.mission.spokesperson_id
          ? access.mission.reserved_by_id
          : access.mission.spokesperson_id;
      await db
        .prepare(
          "INSERT INTO reports (mission_id, reporter_id, reported_id, body) VALUES (?, ?, ?, ?)",
        )
        .bind(missionId, actor.id, reportedId, text)
        .run();
      return { ok: true };
    },
  };
}
