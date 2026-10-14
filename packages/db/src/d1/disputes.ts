import type {
  DisputeActor,
  DisputeAttachment,
  DisputeCase,
  DisputeDecisionView,
  DisputeRepository,
  DisputeStatementView,
  DisputeStatus,
  DisputeSummary,
} from "../disputes.ts";
import type { D1DatabaseLike } from "./types.ts";

type Row = {
  id: number;
  mission_id: number;
  mission_title: string;
  status: DisputeStatus;
  category: DisputeSummary["category"];
  opened_by_id: number;
  opened_by_name: string;
  counterpart_id: number;
  counterpart_name: string;
  claim: string;
  mission_status: string;
  delivery_version: number;
  mediator_id: number | null;
  appeal_reviewer_id: number | null;
  close_reason: string | null;
  created_at: string;
  updated_at: string;
};

const CATEGORIES = ["quality", "deadline", "scope", "conduct", "other"];
const OUTCOMES = ["upheld", "partially_upheld", "dismissed"];
const SELECT_DISPUTE = `SELECT d.id, d.mission_id, p.title AS mission_title, d.status, d.category, d.opened_by_id,
    o.name AS opened_by_name, d.counterpart_id, c.name AS counterpart_name, d.claim, d.mission_status,
    d.delivery_version, d.mediator_id, d.appeal_reviewer_id, d.close_reason, d.created_at, d.updated_at
  FROM disputes d JOIN missions p ON p.id = d.mission_id
  JOIN users o ON o.id = d.opened_by_id JOIN users c ON c.id = d.counterpart_id`;

/** The D1 triggers hold the rules; here the error comes back as a typed reason. */
function failureOf(error: unknown) {
  const message = String(error);
  if (
    /disputes_one_active|UNIQUE constraint failed: (disputes\.mission_id|dispute_decisions)/.test(
      message,
    )
  )
    return "conflict" as const;
  if (/dispute_(open|appeal|close)_unavailable/.test(message)) return "unavailable" as const;
  if (/dispute_(assignment_unavailable|decision_unavailable|statement_forbidden)/.test(message))
    return "forbidden" as const;
  if (/dispute_transition_invalid/.test(message)) return "conflict" as const;
  if (/CHECK constraint failed/.test(message)) return "invalid" as const;
  throw error;
}
const fail = (
  reason:
    | ReturnType<typeof failureOf>
    | "not_found"
    | "forbidden"
    | "invalid"
    | "unavailable"
    | "conflict",
) => ({ ok: false, reason }) as const;

export function createD1Disputes(db: D1DatabaseLike): DisputeRepository {
  const now = () => new Date().toISOString();

  async function capabilities(userId: number) {
    const rows = await db
      .prepare("SELECT capability FROM authorized_user_capabilities WHERE user_id = ?")
      .bind(userId)
      .all<{ capability: string }>();
    return new Set(rows.results.map((r) => r.capability));
  }

  async function conflicted(d: Pick<Row, "id" | "mission_id">, userId: number) {
    const row = await db
      .prepare(
        `SELECT EXISTS(SELECT 1 FROM dispute_conflicted_users WHERE dispute_id = ?1 AND user_id = ?2)
             OR EXISTS(SELECT 1 FROM mission_inspections WHERE mission_id = ?3 AND inspector_id = ?2) AS c`,
      )
      .bind(d.id, userId, d.mission_id)
      .first<{ c: number }>();
    return Boolean(row?.c);
  }

  async function load(id: number) {
    return db.prepare(`${SELECT_DISPUTE} WHERE d.id = ?`).bind(id).first<Row>();
  }

  /** Who sees the case: the parties and staff with disputes.read. */
  async function visible(actor: DisputeActor, id: number) {
    const d = await load(id);
    if (!d) return { ok: false as const, reason: "not_found" as const };
    const caps = await capabilities(actor.id);
    const party = actor.id === d.opened_by_id || actor.id === d.counterpart_id;
    if (!party && !caps.has("disputes.read"))
      return { ok: false as const, reason: "forbidden" as const };
    return { ok: true as const, d, caps, party };
  }

  /** The current round's mediator, if any. */
  const currentMediator = (d: Row) => d.appeal_reviewer_id ?? d.mediator_id;

  const summary = (d: Row): DisputeSummary => ({
    id: d.id,
    missionId: d.mission_id,
    missionTitle: d.mission_title,
    status: d.status,
    category: d.category,
    openedById: d.opened_by_id,
    openedByName: d.opened_by_name,
    counterpartId: d.counterpart_id,
    counterpartName: d.counterpart_name,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  });

  return {
    async open(actor, { missionId, category, claim }) {
      if (!CATEGORIES.includes(category)) return fail("invalid");
      const mission = await db
        .prepare(
          "SELECT spokesperson_id, reserved_by_id, status, delivery_version FROM missions WHERE id = ?",
        )
        .bind(missionId)
        .first<{
          spokesperson_id: number;
          reserved_by_id: number | null;
          status: string;
          delivery_version: number;
        }>();
      if (!mission) return fail("not_found");
      const counterpart =
        actor.id === mission.spokesperson_id
          ? mission.reserved_by_id
          : actor.id === mission.reserved_by_id
            ? mission.spokesperson_id
            : null;
      if (counterpart === null) return fail("forbidden");
      try {
        const row = await db
          .prepare(
            `INSERT INTO disputes (mission_id, opened_by_id, counterpart_id, category, claim, mission_status, delivery_version)
             VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
          )
          .bind(
            missionId,
            actor.id,
            counterpart,
            category,
            claim.trim(),
            mission.status,
            mission.delivery_version,
          )
          .first<{ id: number }>();
        return row ? { ok: true, id: row.id } : fail("unavailable");
      } catch (error) {
        return fail(failureOf(error));
      }
    },

    async list(actor) {
      const caps = await capabilities(actor.id);
      const rows = await db
        .prepare(
          `${SELECT_DISPUTE}
           WHERE d.opened_by_id = ?1 OR d.counterpart_id = ?1 OR ?2 = 1
           ORDER BY d.id DESC LIMIT 200`,
        )
        .bind(actor.id, caps.has("disputes.read") ? 1 : 0)
        .all<Row>();
      return { ok: true, disputes: rows.results.map(summary) };
    },

    async get(actor, id) {
      const seen = await visible(actor, id);
      if (!seen.ok) return seen;
      const { d, caps, party } = seen;
      const [statements, attachments, decisions, appeal] = await Promise.all([
        db
          .prepare(
            `SELECT s.id, s.author_id, u.name, s.author_kind, s.body, s.created_at
             FROM dispute_statements s JOIN users u ON u.id = s.author_id WHERE s.dispute_id = ? ORDER BY s.id`,
          )
          .bind(id)
          .all<{
            id: number;
            author_id: number;
            name: string;
            author_kind: "party" | "mediator";
            body: string;
            created_at: string;
          }>(),
        db
          .prepare(
            "SELECT id, statement_id, filename, content_type, size FROM dispute_attachments WHERE dispute_id = ? ORDER BY id",
          )
          .bind(id)
          .all<{
            id: number;
            statement_id: number;
            filename: string;
            content_type: string;
            size: number;
          }>(),
        db
          .prepare(
            `SELECT round, decider_id, decider_name, outcome, rationale, recommendation, created_at
             FROM dispute_decisions WHERE dispute_id = ? ORDER BY round`,
          )
          .bind(id)
          .all<{
            round: 1 | 2;
            decider_id: number;
            decider_name: string;
            outcome: DisputeDecisionView["outcome"];
            rationale: string;
            recommendation: string | null;
            created_at: string;
          }>(),
        db
          .prepare(
            "SELECT requested_by_id, reason, created_at FROM dispute_appeals WHERE dispute_id = ?",
          )
          .bind(id)
          .first<{ requested_by_id: number; reason: string; created_at: string }>(),
      ]);
      const files = new Map<number, DisputeAttachment[]>();
      for (const a of attachments.results) {
        const list = files.get(a.statement_id) ?? [];
        list.push({
          id: a.id,
          statementId: a.statement_id,
          filename: a.filename,
          contentType: a.content_type,
          size: a.size,
        });
        files.set(a.statement_id, list);
      }
      const isConflicted = await conflicted(d, actor.id);
      const live = d.status === "open" || d.status === "in_review" || d.status === "appealed";
      const mediatorTurn = d.status === "in_review" && currentMediator(d) === actor.id;
      const can = {
        statement: (party && live) || (mediatorTurn && !isConflicted),
        take:
          !isConflicted &&
          ((d.status === "open" && caps.has("disputes.mediate")) ||
            (d.status === "appealed" && caps.has("disputes.decide") && d.mediator_id !== actor.id)),
        decide:
          !isConflicted &&
          mediatorTurn &&
          (d.appeal_reviewer_id === null
            ? caps.has("disputes.mediate")
            : caps.has("disputes.decide")),
        appeal: party && d.status === "decided",
        close: !isConflicted && d.status === "decided" && caps.has("disputes.decide"),
        evidence: caps.has("disputes.read"),
      };
      const dispute: DisputeCase = {
        ...summary(d),
        claim: d.claim,
        missionStatus: d.mission_status,
        deliveryVersion: d.delivery_version,
        mediatorId: d.mediator_id,
        appealReviewerId: d.appeal_reviewer_id,
        closeReason: d.close_reason,
        statements: statements.results.map(
          (s): DisputeStatementView => ({
            id: s.id,
            authorId: s.author_id,
            authorName: s.name,
            authorKind: s.author_kind,
            body: s.body,
            createdAt: s.created_at,
            attachments: files.get(s.id) ?? [],
          }),
        ),
        decisions: decisions.results.map((r) => ({
          round: r.round,
          deciderId: r.decider_id,
          deciderName: r.decider_name,
          outcome: r.outcome,
          rationale: r.rationale,
          recommendation: r.recommendation,
          createdAt: r.created_at,
        })),
        appeal: appeal
          ? {
              requestedById: appeal.requested_by_id,
              reason: appeal.reason,
              createdAt: appeal.created_at,
            }
          : null,
        can,
      };
      return { ok: true, dispute };
    },

    async canStatement(actor, id) {
      const seen = await visible(actor, id);
      if (!seen.ok) return seen;
      const { d, party } = seen;
      const live = d.status === "open" || d.status === "in_review" || d.status === "appealed";
      const mediatorTurn = d.status === "in_review" && currentMediator(d) === actor.id;
      return (party && live) || mediatorTurn
        ? { ok: true }
        : fail(party ? "unavailable" : "forbidden");
    },

    async addStatement(actor, id, text, attachment) {
      const allowed = await this.canStatement(actor, id);
      if (!allowed.ok) return allowed;
      const d = (await load(id)) as Row;
      const kind =
        actor.id === d.opened_by_id || actor.id === d.counterpart_id ? "party" : "mediator";
      const body = text.trim() || (attachment ? `Anexo: ${attachment.filename}` : "");
      if (!body) return fail("invalid");
      try {
        const insert = db
          .prepare(
            "INSERT INTO dispute_statements (dispute_id, author_id, author_kind, body) VALUES (?, ?, ?, ?) RETURNING id",
          )
          .bind(id, actor.id, kind, body);
        if (attachment && db.batch) {
          const [first] = await db.batch<{ results?: { id: number }[] }>([
            insert,
            db
              .prepare(
                `INSERT INTO dispute_attachments (dispute_id, statement_id, object_key, filename, content_type, size, sha256)
                 VALUES (?, last_insert_rowid(), ?, ?, ?, ?, ?)`,
              )
              .bind(
                id,
                attachment.objectKey,
                attachment.filename,
                attachment.contentType,
                attachment.size,
                attachment.sha256,
              ),
          ]);
          const statementId = first?.results?.[0]?.id;
          return statementId ? { ok: true, statementId } : fail("unavailable");
        }
        const row = await insert.first<{ id: number }>();
        return row ? { ok: true, statementId: row.id } : fail("unavailable");
      } catch (error) {
        return fail(failureOf(error));
      }
    },

    async take(actor, id) {
      const seen = await visible(actor, id);
      if (!seen.ok) return seen;
      const { d } = seen;
      try {
        const result =
          d.status === "open"
            ? await db
                .prepare(
                  `UPDATE disputes SET mediator_id = ?, status = 'in_review', updated_at = ?
                   WHERE id = ? AND status = 'open' AND mediator_id IS NULL`,
                )
                .bind(actor.id, now(), id)
                .run()
            : d.status === "appealed"
              ? await db
                  .prepare(
                    `UPDATE disputes SET appeal_reviewer_id = ?, status = 'in_review', updated_at = ?
                     WHERE id = ? AND status = 'appealed' AND appeal_reviewer_id IS NULL`,
                  )
                  .bind(actor.id, now(), id)
                  .run()
              : null;
        if (!result) return fail("unavailable");
        // Someone else took it between the read and the write. D1 also counts trigger rows, so the test is "> 0".
        return result.meta.changes > 0 ? { ok: true } : fail("conflict");
      } catch (error) {
        return fail(failureOf(error));
      }
    },

    async decide(actor, id, { outcome, rationale, recommendation }) {
      if (!OUTCOMES.includes(outcome)) return fail("invalid");
      const seen = await visible(actor, id);
      if (!seen.ok) return seen;
      const { d } = seen;
      const round = d.appeal_reviewer_id === null ? 1 : 2;
      // Repeating the same decision (resend, network) is harmless; a different decision for the round is a conflict.
      const same = await db
        .prepare(
          `SELECT 1 AS ok FROM dispute_decisions WHERE dispute_id = ? AND round = ? AND decider_id = ? AND outcome = ? AND rationale = ?`,
        )
        .bind(id, round, actor.id, outcome, rationale.trim())
        .first();
      if (same) return { ok: true, round };
      const taken = await db
        .prepare("SELECT 1 AS ok FROM dispute_decisions WHERE dispute_id = ? AND round = ?")
        .bind(id, round)
        .first();
      if (taken) return fail("conflict");
      const me = await db
        .prepare("SELECT name FROM users WHERE id = ?")
        .bind(actor.id)
        .first<{ name: string }>();
      try {
        await db
          .prepare(
            `INSERT INTO dispute_decisions (dispute_id, round, decider_id, decider_name, outcome, rationale, recommendation)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            id,
            round,
            actor.id,
            me?.name ?? actor.name,
            outcome,
            rationale.trim(),
            recommendation?.trim() || null,
          )
          .run();
        return { ok: true, round };
      } catch (error) {
        return fail(failureOf(error));
      }
    },

    async appeal(actor, id, reason) {
      const seen = await visible(actor, id);
      if (!seen.ok) return seen;
      if (!seen.party) return fail("forbidden"); // only the parties appeal
      try {
        await db
          .prepare(
            "INSERT INTO dispute_appeals (dispute_id, requested_by_id, reason) VALUES (?, ?, ?)",
          )
          .bind(id, actor.id, reason.trim())
          .run();
        return { ok: true };
      } catch (error) {
        const failure = failureOf(error);
        // Second appeal attempt: the trigger blocks by state, the primary key by duplication.
        return fail(
          /UNIQUE constraint failed: dispute_appeals/.test(String(error)) ? "conflict" : failure,
        );
      }
    },

    async close(actor, id, reason) {
      const seen = await visible(actor, id);
      if (!seen.ok) return seen;
      // Authority and ties come before state: whoever cannot close gets 403, not 409.
      if (!seen.caps.has("disputes.decide") || (await conflicted(seen.d, actor.id)))
        return fail("forbidden");
      try {
        const result = await db
          .prepare(
            `UPDATE disputes SET status = 'closed', closed_by_id = ?, close_reason = ?, updated_at = ?
             WHERE id = ? AND status = 'decided'`,
          )
          .bind(actor.id, reason.trim(), now(), id)
          .run();
        return result.meta.changes > 0 ? { ok: true } : fail("unavailable");
      } catch (error) {
        return fail(failureOf(error));
      }
    },

    async evidence(actor, id) {
      const seen = await visible(actor, id);
      if (!seen.ok) return seen;
      if (!seen.caps.has("disputes.read")) return fail("forbidden");
      const [capture, items] = await Promise.all([
        db
          .prepare("SELECT captured_at FROM dispute_evidence_captures WHERE dispute_id = ?")
          .bind(id)
          .first<{ captured_at: string }>(),
        db
          .prepare(
            "SELECT kind, source_id, payload FROM dispute_evidence WHERE dispute_id = ? ORDER BY kind, source_id",
          )
          .bind(id)
          .all<{ kind: string; source_id: string; payload: string }>(),
      ]);
      return {
        ok: true,
        capturedAt: capture?.captured_at ?? "",
        items: items.results.map((r) => ({
          kind: r.kind,
          sourceId: r.source_id,
          payload: JSON.parse(r.payload),
        })),
      };
    },

    async attachmentFor(actor, id, attachmentId) {
      const seen = await visible(actor, id);
      if (!seen.ok) return seen;
      // Filtering by dispute stops opening another case's attachment by id.
      const row = await db
        .prepare(
          `SELECT id, statement_id, object_key, filename, content_type, size FROM dispute_attachments
           WHERE id = ? AND dispute_id = ?`,
        )
        .bind(attachmentId, id)
        .first<{
          id: number;
          statement_id: number;
          object_key: string;
          filename: string;
          content_type: string;
          size: number;
        }>();
      if (!row) return fail("not_found");
      return {
        ok: true,
        attachment: {
          id: row.id,
          statementId: row.statement_id,
          objectKey: row.object_key,
          filename: row.filename,
          contentType: row.content_type,
          size: row.size,
        },
      };
    },

    async setMediator(admin, userId, granted) {
      const target = await db
        .prepare("SELECT role FROM users WHERE id = ? AND is_banned = 0")
        .bind(userId)
        .first<{ role: string }>();
      if (!target) return fail("not_found");
      if (target.role !== "inspector" && target.role !== "admin") return fail("invalid");
      const change = granted
        ? db
            .prepare("INSERT OR IGNORE INTO dispute_mediators (user_id, granted_by) VALUES (?, ?)")
            .bind(userId, admin.id)
        : db.prepare("DELETE FROM dispute_mediators WHERE user_id = ?").bind(userId);
      const audit = db
        .prepare(
          `INSERT INTO admin_audit (actor_id, action, entity, entity_id, details, created_at)
           VALUES (?, ?, 'user', ?, json_object('capability', 'disputes.mediate'), ?)`,
        )
        .bind(
          admin.id,
          granted ? "disputa_mediador_concedido" : "disputa_mediador_removido",
          String(userId),
          now(),
        );
      if (db.batch) await db.batch([change, audit]);
      else {
        await change.run();
        await audit.run();
      }
      return { ok: true };
    },
  };
}
