import {
  ownerControls,
  validateOwnerAction,
  type MissionOwnerRepository,
} from "../mission-owner.ts";
import type { D1DatabaseLike } from "./types.ts";

type OwnerRow = {
  status: string;
  spokesperson_id: number;
  reserved_by_id: number | null;
  reserved_at: string | null;
  first_delivered_at: string | null;
  lifecycle_version: number;
};
type EventRow = {
  mission_id: number;
  actor_id: number;
  action: string;
  reason: string;
  expected_version: number;
};

export function createD1MissionOwner(
  db: D1DatabaseLike,
  clock: () => Date = () => new Date(),
): MissionOwnerRepository {
  const mission = (id: number) =>
    db
      .prepare(
        "SELECT status, spokesperson_id, reserved_by_id, reserved_at, first_delivered_at, lifecycle_version FROM missions WHERE id = ?",
      )
      .bind(id)
      .first<OwnerRow>();
  return {
    async controls(missionId, actorId) {
      const row = await mission(missionId);
      if (!row) return { ok: false, reason: "mission_not_found" };
      if (row.spokesperson_id !== actorId) return { ok: false, reason: "forbidden" };
      return { ok: true, controls: ownerControls(row, clock().getTime()) };
    },
    async act(input) {
      const invalid = validateOwnerAction(input);
      if (invalid) return { ok: false, reason: invalid };
      const reason = input.reason.trim();
      const row = await mission(input.missionId);
      if (!row) return { ok: false, reason: "mission_not_found" };
      if (row.spokesperson_id !== input.actorId) return { ok: false, reason: "forbidden" };
      const previous = await db
        .prepare("SELECT * FROM mission_owner_events WHERE request_id = ?")
        .bind(input.requestId)
        .first<{
          mission_id: number;
          actor_id: number;
          action: string;
          reason: string;
          expected_version: number;
        }>();
      if (previous)
        return previous.mission_id === input.missionId &&
          previous.actor_id === input.actorId &&
          previous.action === input.action &&
          previous.reason === reason &&
          previous.expected_version === input.version
          ? { ok: true }
          : { ok: false, reason: "conflict" };
      try {
        await db
          .prepare(
            `INSERT INTO mission_owner_events(request_id,mission_id,actor_id,action,reason,expected_version,previous_editor_id,created_at) VALUES(?,?,?,?,?,?,?,?)`,
          )
          .bind(
            input.requestId,
            input.missionId,
            input.actorId,
            input.action,
            reason,
            input.version,
            row.reserved_by_id,
            clock().toISOString(),
          )
          .run();
        return { ok: true };
      } catch (error) {
        const message = String(error);
        if (message.includes("owner_action_conflict")) return { ok: false, reason: "conflict" };
        if (message.includes("UNIQUE constraint failed: mission_owner_events.request_id")) {
          // Another identical request may have committed while this request read.
          const event = await db
            .prepare(
              "SELECT mission_id,actor_id,action,reason,expected_version FROM mission_owner_events WHERE request_id = ?",
            )
            .bind(input.requestId)
            .first<EventRow>();
          if (
            event &&
            event.mission_id === input.missionId &&
            event.actor_id === input.actorId &&
            event.action === input.action &&
            event.reason === reason &&
            event.expected_version === input.version
          )
            return { ok: true };
          return { ok: false, reason: "conflict" };
        }
        throw error;
      }
    },
    async notifications(actorId) {
      const { results } = await db
        .prepare(
          `SELECT request_id AS id, mission_id AS missionId, action, reason, created_at AS createdAt FROM mission_owner_events WHERE previous_editor_id = ? ORDER BY created_at DESC LIMIT 50`,
        )
        .bind(actorId)
        .all<{
          id: string;
          missionId: number;
          action: string;
          reason: string;
          createdAt: string;
        }>();
      return results;
    },
  };
}
