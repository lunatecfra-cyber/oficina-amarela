import { sql, withTransaction } from "./client.ts";
import { type MissionOwnerRepository, validateOwnerAction } from "./mission-owner.ts";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export const postgresMissionOwner: MissionOwnerRepository = {
  async controls(missionId, actorId) {
    const [p] = await sql`
      SELECT porta_voz_id, status, lifecycle_version, first_delivered_at,
        reservada_em + interval '48 hours' AS available_at,
        reservada_em <= clock_timestamp() - interval '48 hours' AS elapsed,
        reservada_por_id
      FROM pautas WHERE id = ${missionId}`;
    if (!p) return { ok: false, reason: "mission_not_found" };
    if (p.porta_voz_id !== actorId) return { ok: false, reason: "forbidden" };
    const canCancel =
      !p.first_delivered_at && ["disponivel", "oferecida", "reservada"].includes(p.status);
    const eligible = canCancel && p.status === "reservada" && p.reservada_por_id != null;
    return {
      ok: true,
      controls: {
        canCancel,
        canReassign: eligible && p.elapsed === true,
        reassignAvailableAt:
          eligible && p.available_at ? new Date(p.available_at).toISOString() : null,
        cancelled: p.status === "cancelada",
        version: p.lifecycle_version,
      },
    };
  },
  async act(input) {
    if (
      !Number.isSafeInteger(input.missionId) ||
      input.missionId <= 0 ||
      !Number.isSafeInteger(input.actorId) ||
      input.actorId <= 0 ||
      typeof input.requestId !== "string"
    ) {
      return { ok: false, reason: "invalid_request" };
    }
    const invalid = validateOwnerAction(input);
    if (invalid) return { ok: false, reason: invalid };
    const reason = input.reason.trim();
    return withTransaction(async (tx) => {
      // Serialize request IDs across missions as well as retries on one mission.
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${input.requestId}, 0))`;
      const [p] = await tx`SELECT *,
        reservada_em <= clock_timestamp() - interval '48 hours' AS elapsed
        FROM pautas WHERE id = ${input.missionId} FOR UPDATE`;
      if (!p) return { ok: false, reason: "mission_not_found" };
      if (p.porta_voz_id !== input.actorId) return { ok: false, reason: "forbidden" };
      const [event] =
        await tx`SELECT * FROM mission_owner_events WHERE request_id = ${input.requestId}`;
      if (event) {
        return event.mission_id === input.missionId &&
          event.actor_id === input.actorId &&
          event.action === input.action &&
          event.reason === reason &&
          event.expected_version === input.version
          ? { ok: true }
          : { ok: false, reason: "conflict" };
      }
      if (
        p.first_delivered_at ||
        !["disponivel", "oferecida", "reservada"].includes(p.status) ||
        p.lifecycle_version !== input.version ||
        (input.action === "reassign_mission" &&
          (p.status !== "reservada" || !p.reservada_por_id || p.elapsed !== true))
      ) {
        return { ok: false, reason: "conflict" };
      }
      const cancel = input.action === "cancel_mission";
      await tx`UPDATE pautas SET status = ${cancel ? "cancelada" : "disponivel"},
        cancelled_at = CASE WHEN ${cancel} THEN clock_timestamp() ELSE cancelled_at END,
        cancellation_reason = CASE WHEN ${cancel} THEN ${reason} ELSE cancellation_reason END,
        excluded_editor_id = CASE WHEN ${cancel} THEN excluded_editor_id ELSE reservada_por_id END,
        reservada_por_id = NULL, reservada_em = NULL, reservada_ate = NULL
        WHERE id = ${input.missionId}`;
      await tx`INSERT INTO mission_owner_events
        (request_id, mission_id, actor_id, action, reason, expected_version, previous_editor_id)
        VALUES (${input.requestId}, ${input.missionId}, ${input.actorId}, ${input.action},
          ${reason}, ${input.version}, ${p.reservada_por_id})`;
      await tx`UPDATE ofertas SET status = 'expirada', respondida_em = clock_timestamp()
        WHERE pauta_id = ${input.missionId} AND status = 'pendente'`;
      if (p.reservada_por_id != null) {
        const subject = cancel ? "Missao cancelada" : "Missao reatribuida";
        const html = `<p>${subject}: ${escapeHtml(p.titulo)}</p><p>${escapeHtml(reason)}</p>`;
        await tx`INSERT INTO fila_emails(chave, destinatario, assunto, html)
          SELECT ${`mission-owner:${input.requestId}`}, email, ${subject}, ${html}
          FROM users WHERE id = ${p.reservada_por_id}
          ON CONFLICT (chave) DO NOTHING`;
      }
      return { ok: true };
    });
  },
  async notifications(actorId) {
    const rows = await sql`SELECT request_id, mission_id, action, reason, created_at
      FROM mission_owner_events WHERE previous_editor_id = ${actorId}
      ORDER BY created_at DESC, request_id DESC LIMIT 50`;
    return rows.map((r) => ({
      id: r.request_id,
      missionId: r.mission_id,
      action: r.action,
      reason: r.reason,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  },
};
