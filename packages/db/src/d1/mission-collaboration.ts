import { LIMITS, limitStr } from "@oficina/domain/limits";
import type { Role } from "@oficina/domain/roles";
import { roleFromDb } from "../accounts.ts";
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
  const role: Role = roleFromDb(rawRole ?? "editor");
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
    seq: row.id,
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
    if (actor.role === "inspector") return { ok: false as const, reason: "forbidden" as const };
    const mission = await db
      .prepare(
        "SELECT spokesperson_id, reserved_by_id,EXISTS(SELECT 1 FROM authorized_user_capabilities c WHERE c.user_id=? AND c.capability='mission.read') AS can_read FROM missions WHERE id = ?",
      )
      .bind(actor.id, missionId)
      .first<{ spokesperson_id: number; reserved_by_id: number | null; can_read: number }>();
    if (!mission) return { ok: false as const, reason: "mission_not_found" as const };
    if (
      !mission.can_read &&
      actor.id !== mission.spokesperson_id &&
      actor.id !== mission.reserved_by_id
    ) {
      return { ok: false as const, reason: "forbidden" as const };
    }
    return { ok: true as const, mission };
  }

  const PAGE_DEFAULT = 100;
  const PAGE_MAX = 200;

  // Marcos que as duas partes podem ver. `offer` (antes da atribuição), `inspection_pending`
  // (aviso interno) e as ações de transferência ficam de fora, e `notes` nunca é lido.
  const TIMELINE = [
    "accepted",
    "submitted",
    "revision",
    "inspection_approved",
    "inspection_rejected",
    "approved",
    "returned",
  ];

  return {
    async missionEvents(missionId, actor) {
      const access = await participant(missionId, actor);
      if (!access.ok) return access;
      const rows = await db
        .prepare(
          `SELECT key, event, version, created_at FROM mission_notifications
           WHERE mission_id = ? AND event IN (${TIMELINE.map(() => "?").join(",")})
           ORDER BY created_at, key LIMIT 200`,
        )
        .bind(missionId, ...TIMELINE)
        .all<{ key: string; event: string; version: number; created_at: string }>();
      return {
        ok: true,
        events: rows.results.map((r) => ({
          id: r.key,
          event: r.event,
          version: r.version,
          at: r.created_at,
        })),
      };
    },

    async messagePage(missionId, actor, { afterId, beforeId, limit }) {
      const access = await participant(missionId, actor);
      if (!access.ok) return access;
      const size = Math.min(Math.max(Math.trunc(limit ?? PAGE_DEFAULT), 1), PAGE_MAX);
      const ascending = afterId !== undefined;
      // Um a mais que o pedido: a sobra só diz se há outra página.
      const rows = await db
        .prepare(
          `SELECT m.id, m.mission_id, m.author_id, u.name, u.role, m.body, m.created_at
           FROM messages m JOIN users u ON u.id = m.author_id
           WHERE m.mission_id = ? AND (? IS NULL OR m.id > ?) AND (? IS NULL OR m.id < ?)
           ORDER BY m.id ${ascending ? "ASC" : "DESC"} LIMIT ?`,
        )
        .bind(
          missionId,
          afterId ?? null,
          afterId ?? null,
          beforeId ?? null,
          beforeId ?? null,
          size + 1,
        )
        .all<MessageRow>();
      const hasMore = rows.results.length > size;
      const page = rows.results.slice(0, size);
      if (!ascending) page.reverse();
      return { ok: true, messages: page.map(rowToMessage), hasMore };
    },

    async markRead(missionId, actor, upToMessageId) {
      // Só quem conversa na missão guarda marcador; quem apenas lê (inspeção) não.
      const mission = await db
        .prepare("SELECT spokesperson_id, reserved_by_id FROM missions WHERE id = ?")
        .bind(missionId)
        .first<{ spokesperson_id: number; reserved_by_id: number | null }>();
      if (!mission) return { ok: false, reason: "mission_not_found" };
      if (actor.id !== mission.spokesperson_id && actor.id !== mission.reserved_by_id)
        return { ok: false, reason: "forbidden" };
      // O teto é a última mensagem da missão, e o upsert só avança: repetir ou
      // reordenar chamadas deixa o mesmo resultado.
      const row = await db
        .prepare(
          `INSERT INTO message_reads (mission_id, user_id, last_read_message_id)
           VALUES (?1, ?2, MIN(?3, COALESCE((SELECT MAX(id) FROM messages WHERE mission_id = ?1), 0)))
           ON CONFLICT (mission_id, user_id) DO UPDATE SET
             last_read_message_id = MAX(last_read_message_id, excluded.last_read_message_id),
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           RETURNING last_read_message_id`,
        )
        .bind(missionId, actor.id, Math.max(0, Math.trunc(upToMessageId)))
        .first<{ last_read_message_id: number }>();
      return { ok: true, lastReadId: row?.last_read_message_id ?? 0 };
    },

    async unreadMissions(actor) {
      const rows = await db
        .prepare(
          `SELECT mission_id, title, unread, last_message_id FROM (
             SELECT ms.id AS mission_id, ms.title AS title,
               (SELECT COUNT(*) FROM messages m
                 WHERE m.mission_id = ms.id AND m.author_id <> ?1
                   AND m.id > COALESCE((SELECT r.last_read_message_id FROM message_reads r
                                         WHERE r.mission_id = ms.id AND r.user_id = ?1), 0)) AS unread,
               (SELECT MAX(id) FROM messages WHERE mission_id = ms.id) AS last_message_id
             FROM missions ms WHERE ms.spokesperson_id = ?1 OR ms.reserved_by_id = ?1
           ) WHERE unread > 0 ORDER BY last_message_id DESC LIMIT 100`,
        )
        .bind(actor.id)
        .all<{ mission_id: number; title: string; unread: number; last_message_id: number }>();
      return {
        ok: true,
        missions: rows.results.map((r) => ({
          missionId: r.mission_id,
          title: r.title,
          unread: r.unread,
          lastMessageId: r.last_message_id,
        })),
      };
    },

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
      if (actor.role === "inspector") return { ok: false as const, reason: "forbidden" as const };
      const allowed = await db
        .prepare(
          "SELECT 1 FROM authorized_user_capabilities WHERE user_id=? AND capability='mission.read'",
        )
        .bind(actor.id)
        .first();
      if (!allowed) return { ok: false, reason: "forbidden" as const };
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
      if (!row) return { ok: false, reason: "write_failed" };
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
