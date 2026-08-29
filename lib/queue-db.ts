import { sql } from "@/lib/db";
import type { Mission } from "@/lib/missions";

export const OFFER_MINUTES = 5;
export const MINUTOS_OFERTA = OFFER_MINUTES;

const PRESENCE_MINUTES = 3;

export type Offer = {
  mission: Mission;
  expiresAt: string;
  orderIndex: number;
  // compatibility aliases
  pauta?: Mission;
  expiraEm?: string;
  ordem?: number;
};

export type Oferta = Offer;

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "23505"
  );
}

export async function markEditorActive(editorId: number): Promise<void> {
  await sql`UPDATE users SET last_seen_at = now() WHERE id = ${editorId}`;
}

export const marcarEditorAtivo = markEditorActive;

export async function expireTimedOutOffers(): Promise<number> {
  const expired = await sql`
    UPDATE offers o
    SET status = 'expired', responded_at = now()
    FROM users u
    WHERE o.status = 'pending'
      AND (
        o.offered_at <= now() - (${OFFER_MINUTES} || ' minutes')::interval
        OR
        (o.editor_id = u.id AND u.last_seen_at <= now() - interval '3 minutes')
      )
    RETURNING o.mission_id
  `;
  if (expired.length === 0) return 0;

  const ids = expired.map((v) => v.mission_id as number);
  await sql`
    UPDATE missions SET status = 'available'
    WHERE id = ANY(${ids}) AND status = 'offered'
  `;
  return expired.length;
}

export const expirarOfertasVencidas = expireTimedOutOffers;

async function getNextEditor(
  missionId: number,
  spokespersonId: number
): Promise<number | null> {
  const [row] = await sql`
    WITH now_block AS (
      SELECT
        (EXTRACT(DOW FROM now() AT TIME ZONE 'UTC')::int + 6) % 7 AS day_idx,
        CASE
          WHEN EXTRACT(HOUR FROM now() AT TIME ZONE 'UTC') BETWEEN 6 AND 11 THEN 0
          WHEN EXTRACT(HOUR FROM now() AT TIME ZONE 'UTC') BETWEEN 12 AND 17 THEN 1
          ELSE 2
        END AS period_idx
    )
    SELECT u.id
    FROM users u, now_block nb
    WHERE u.role = 'editor'
      AND u.last_seen_at > now() - (${PRESENCE_MINUTES} || ' minutes')::interval
      AND (u.booking_locked_until IS NULL OR u.booking_locked_until <= now())
      AND (
        u.availability IS NULL
        OR u.availability -> nb.period_idx -> nb.day_idx IS NULL
        OR (u.availability -> nb.period_idx ->> nb.day_idx) = 'true'
      )
      AND NOT EXISTS (
        SELECT 1 FROM missions m
        WHERE m.reserved_by_id = u.id
          AND m.status IN ('reserved','in_review','revision_requested')
      )
      AND NOT EXISTS (
        SELECT 1 FROM offers o WHERE o.editor_id = u.id AND o.status = 'pending'
      )
      AND NOT EXISTS (
        SELECT 1 FROM offers o WHERE o.editor_id = u.id AND o.mission_id = ${missionId}
      )
    ORDER BY
      (SELECT COUNT(*) FROM missions h
       WHERE h.reserved_by_id = u.id
         AND h.spokesperson_id = ${spokespersonId}
         AND h.status IN ('approved','completed')) DESC,
      u.delivered_count DESC,
      u.last_seen_at ASC
    LIMIT 1
  `;
  return row?.id ?? null;
}

export async function dispatchMissions(): Promise<number> {
  const pendingMissions = await sql`
    SELECT id, spokesperson_id FROM missions
    WHERE status = 'available'
    ORDER BY priority DESC, created_at ASC
    LIMIT 20
  `;

  let dispatched = 0;
  for (const m of pendingMissions) {
    const editorId = await getNextEditor(m.id, m.spokesperson_id);
    if (!editorId) continue;

    try {
      const [orderRow] = await sql`
        SELECT COALESCE(MAX(order_index), 0) + 1 AS next_order FROM offers WHERE mission_id = ${m.id}
      `;
      const orderIndex = orderRow?.next_order ?? 1;

      await sql`
        INSERT INTO offers (mission_id, editor_id, expires_at, order_index)
        VALUES (${m.id}, ${editorId},
                now() + (${OFFER_MINUTES} || ' minutes')::interval,
                ${orderIndex})
      `;

      await sql`
        UPDATE missions SET status = 'offered'
        WHERE id = ${m.id} AND status = 'available'
      `;
      dispatched++;
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  return dispatched;
}

export const despacharMissoes = dispatchMissions;

export async function getPendingOffer(editorId: number): Promise<Offer | null> {
  const [l] = await sql`
    SELECT o.expires_at, o.order_index,
           m.id, m.title, m.format, m.drive_link, m.youtube_link, m.status,
           m.brief_tone, m.brief_color, m.brief_font, m.brief_references,
           m.extras, m.motivation, m.desired_deadline, m.created_at,
           u.name AS spokesperson_name, u.handle AS spokesperson_handle
    FROM offers o
    JOIN missions m ON m.id = o.mission_id
    JOIN users u ON u.id = m.spokesperson_id
    WHERE o.editor_id = ${editorId} AND o.status = 'pending' AND o.expires_at > now()
    LIMIT 1
  `;
  if (!l) return null;

  const missionObj: Mission = {
    id: `db-${l.id}`,
    spokesperson: l.spokesperson_name,
    spokespersonHandle: l.spokesperson_handle,
    title: l.title,
    format: l.format,
    brief: {
      tone: l.brief_tone ?? undefined,
      color: l.brief_color ?? undefined,
      font: l.brief_font ?? undefined,
      refs: l.brief_references ?? undefined,
      tom: l.brief_tone ?? undefined,
      cor: l.brief_color ?? undefined,
      fonte: l.brief_font ?? undefined,
    },
    status: l.status,
    createdAt: new Date(l.created_at).toISOString(),
    driveLink: l.drive_link ?? undefined,
    youtubeLink: l.youtube_link ?? undefined,
    extras: l.extras ?? undefined,
    motivation: l.motivation ?? undefined,
    desiredDeadline: l.desired_deadline
      ? new Date(l.desired_deadline).toISOString().slice(0, 10)
      : undefined,
    portaVoz: l.spokesperson_name,
    portaVozApelido: l.spokesperson_handle,
    titulo: l.title,
    formato: l.format,
    criadaEm: new Date(l.created_at).toISOString(),
  };

  return {
    expiresAt: new Date(l.expires_at).toISOString(),
    orderIndex: l.order_index,
    mission: missionObj,
    expiraEm: new Date(l.expires_at).toISOString(),
    ordem: l.order_index,
    pauta: missionObj,
  };
}

export const ofertaPendente = getPendingOffer;

export async function acceptOffer(
  missionId: number,
  editorId: number
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const closed = await sql`
    UPDATE offers SET status = 'accepted', responded_at = now()
    WHERE mission_id = ${missionId} AND editor_id = ${editorId}
      AND status = 'pending' AND expires_at > now()
    RETURNING id
  `;
  if (closed.length === 0) {
    return { ok: false, error: "This offer is no longer valid.", erro: "This offer is no longer valid." };
  }

  await sql`
    UPDATE missions
    SET status = 'reserved',
        reserved_by_id = ${editorId},
        reserved_at = now()
    WHERE id = ${missionId} AND status = 'offered'
  `;
  return { ok: true };
}

export const aceitarOferta = acceptOffer;

export async function rejectOffer(
  missionId: number,
  editorId: number
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const closed = await sql`
    UPDATE offers SET status = 'rejected', responded_at = now()
    WHERE mission_id = ${missionId} AND editor_id = ${editorId} AND status = 'pending'
    RETURNING id
  `;
  if (closed.length === 0) {
    return { ok: false, error: "This offer is no longer valid.", erro: "This offer is no longer valid." };
  }

  await sql`
    UPDATE missions SET status = 'available'
    WHERE id = ${missionId} AND status = 'offered'
  `;
  return { ok: true };
}

export const recusarOferta = rejectOffer;

export async function getOnlineEditorsCount(): Promise<number> {
  const [l] = await sql`
    SELECT COUNT(*)::int AS total FROM users
    WHERE role = 'editor'
      AND last_seen_at > now() - (${PRESENCE_MINUTES} || ' minutes')::interval
  `;
  return l?.total ?? 0;
}

export const editoresOnline = getOnlineEditorsCount;

export const acceptMissionOffer = acceptOffer;
export const declineMissionOffer = rejectOffer;
export const expireStaleOffers = expireTimedOutOffers;
export const pendingOfferForEditor = getPendingOffer;
