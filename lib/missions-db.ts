import { sql } from "@/lib/db";
import { awardReferralIfEligible } from "@/lib/electoral-ranking-db";
import { LIMITS, limitStr, limitOrNull } from "@/lib/limits";
import type { VideoFormat, Mission, MissionStatus } from "@/lib/missions";
import { isLikelyUrl } from "@/lib/validators";

type MissionRow = {
  id: number;
  spokesperson_name: string;
  spokesperson_handle: string;
  title: string;
  format: VideoFormat;
  brief_tone: string | null;
  brief_color: string | null;
  brief_font: string | null;
  brief_references: string | null;
  drive_link: string | null;
  youtube_link: string | null;
  status: MissionStatus;
  reserved_by_handle: string | null;
  reserved_at: string | null;
  delivery_link: string | null;
  inspector_notes: string | null;
  created_at: string;
  extras: string | null;
  motivation: string | null;
  desired_deadline: Date | string | null;
  revision_requested_by: "inspector" | "spokesperson" | null;
  raw_video_url: string | null;
  delivery_video_url: string | null;
  watermark: string | null;
  campaign_tax_id: string | null;
  voter_id: string | null;
};

function rowToMission(r: MissionRow): Mission {
  const desiredDeadlineStr = r.desired_deadline
    ? new Date(r.desired_deadline).toISOString().slice(0, 10)
    : undefined;

  return {
    id: `db-${r.id}`,
    spokesperson: r.spokesperson_name,
    spokespersonHandle: r.spokesperson_handle,
    title: r.title,
    format: r.format,
    brief: {
      tone: r.brief_tone ?? undefined,
      color: r.brief_color ?? undefined,
      font: r.brief_font ?? undefined,
      refs: r.brief_references ?? undefined,
      tom: r.brief_tone ?? undefined,
      cor: r.brief_color ?? undefined,
      fonte: r.brief_font ?? undefined,
    },
    status: r.status,
    createdAt: new Date(r.created_at).toISOString(),
    reservedBy: r.reserved_by_handle ?? undefined,
    reservedAt: r.reserved_at ? new Date(r.reserved_at).toISOString() : undefined,
    driveLink: r.drive_link ?? undefined,
    youtubeLink: r.youtube_link ?? undefined,
    deliveryLink: r.delivery_link ?? undefined,
    inspectorNotes: r.inspector_notes ?? undefined,
    extras: r.extras ?? undefined,
    motivation: r.motivation ?? undefined,
    desiredDeadline: desiredDeadlineStr,
    revisionRequestedBy: r.revision_requested_by ?? undefined,
    rawVideoUrl: r.raw_video_url ?? undefined,
    deliveryVideoUrl: r.delivery_video_url ?? undefined,
    watermark: r.watermark ?? undefined,
    campaignTaxId: r.campaign_tax_id ?? undefined,
    voterId: r.voter_id ?? undefined,
    // compatibility aliases
    portaVoz: r.spokesperson_name,
    portaVozApelido: r.spokesperson_handle,
    titulo: r.title,
    formato: r.format,
    criadaEm: new Date(r.created_at).toISOString(),
    reservadaPor: r.reserved_by_handle ?? undefined,
    reservadaEm: r.reserved_at ? new Date(r.reserved_at).toISOString() : undefined,
    entregaLink: r.delivery_link ?? undefined,
    notasInspetor: r.inspector_notes ?? undefined,
    motivo: r.motivation ?? undefined,
    prazoDesejado: desiredDeadlineStr,
    reedicaoPedidaPor: r.revision_requested_by ?? undefined,
    videoBrutoUrl: r.raw_video_url ?? undefined,
    videoEntregaUrl: r.delivery_video_url ?? undefined,
    marcaDagua: r.watermark ?? undefined,
    cnpjCampanha: r.campaign_tax_id ?? undefined,
    tituloEleitor: r.voter_id ?? undefined,
  };
}

const BASE_SELECT = sql`
  SELECT m.id, u.name AS spokesperson_name, u.handle AS spokesperson_handle, m.title, m.format,
         m.brief_tone, m.brief_color, m.brief_font, m.brief_references,
         m.drive_link, m.youtube_link, m.status, m.reserved_at, m.delivery_link,
         m.inspector_notes, m.created_at,
         m.extras, m.motivation, m.desired_deadline, m.revision_requested_by,
         m.raw_video_url, m.delivery_video_url, m.watermark, m.campaign_tax_id, m.voter_id,
         e.handle AS reserved_by_handle
  FROM missions m
  JOIN users u ON u.id = m.spokesperson_id
  LEFT JOIN users e ON e.id = m.reserved_by_id
`;

export async function createMission(data: {
  spokespersonId: number;
  title: string;
  format: VideoFormat;
  driveLink?: string;
  youtubeLink?: string;
  tone?: string;
  color?: string;
  font?: string;
  refs?: string;
  extras?: string;
  motivation?: string;
  deadline?: string;
  desiredDeadline?: string;
  rawVideoUrl?: string;
  rawFootageUrl?: string;
  publishedYoutubeUrl?: string;
  extraInstructions?: string;
  rationale?: string;
  watermarkUrl?: string;
  voterRegistrationId?: string;
  watermark?: string;
  campaignTaxId?: string;
  voterId?: string;
  // aliases
  portaVozId?: number;
  titulo?: string;
  formato?: VideoFormat;
  tom?: string;
  cor?: string;
  fonte?: string;
  motivo?: string;
  prazo?: string;
  videoBrutoUrl?: string;
  marcaDagua?: string;
  cnpjCampanha?: string;
  tituloEleitor?: string;
}): Promise<{ ok: true; id: number } | { ok: false; error: string; erro?: string }> {
  const spokespersonId = data.spokespersonId ?? data.portaVozId;
  const rawTitle = data.title ?? data.titulo;
  const rawFormat = data.format ?? data.formato;

  if (!spokespersonId) return { ok: false, error: "Spokesperson ID required.", erro: "Spokesperson ID required." };
  const title = limitStr(rawTitle, LIMITS.title);
  if (!title) return { ok: false, error: "Please enter a mission title.", erro: "Please enter a mission title." };
  if (rawFormat !== "short" && rawFormat !== "long") {
    return { ok: false, error: "Please select a video format.", erro: "Please select a video format." };
  }

  const brief = {
    tone: limitOrNull(data.tone ?? data.tom, LIMITS.briefField),
    color: limitOrNull(data.color ?? data.cor, LIMITS.briefField),
    font: limitOrNull(data.font ?? data.fonte, LIMITS.briefField),
    refs: limitOrNull(data.refs, LIMITS.briefField),
    extras: limitOrNull(data.extras, LIMITS.longText),
    motivation: limitOrNull(data.motivation ?? data.motivo, LIMITS.longText),
    driveLink: limitOrNull(data.driveLink, LIMITS.link),
    youtubeLink: limitOrNull(data.youtubeLink, LIMITS.link),
    deadline: limitOrNull(data.deadline ?? data.prazo, 10),
    rawVideoUrl: limitOrNull(data.rawVideoUrl ?? data.videoBrutoUrl, LIMITS.link),
    watermark: limitOrNull(data.watermark ?? data.marcaDagua, LIMITS.briefField),
    campaignTaxId: limitOrNull(data.campaignTaxId ?? data.cnpjCampanha, LIMITS.briefField),
    voterId: limitOrNull(data.voterId ?? data.tituloEleitor, LIMITS.briefField),
  };

  const [row] = await sql`
    INSERT INTO missions (spokesperson_id, title, format, drive_link, youtube_link,
                         brief_tone, brief_color, brief_font, brief_references,
                         extras, motivation, desired_deadline, raw_video_url,
                         watermark, campaign_tax_id, voter_id)
    VALUES (${spokespersonId}, ${title}, ${rawFormat},
            ${brief.driveLink}, ${brief.youtubeLink},
            ${brief.tone}, ${brief.color},
            ${brief.font}, ${brief.refs},
            ${brief.extras},
            ${brief.motivation},
            ${brief.deadline},
            ${brief.rawVideoUrl},
            ${brief.watermark},
            ${brief.campaignTaxId},
            ${brief.voterId})
    RETURNING id
  `;
  return { ok: true, id: row.id };
}

export const criarPauta = createMission;

export async function getSpokespersonMissions(spokespersonId: number): Promise<Mission[]> {
  const rows = await sql`
    ${BASE_SELECT} WHERE m.spokesperson_id = ${spokespersonId} ORDER BY m.created_at DESC
  `;
  return (rows as unknown as MissionRow[]).map(rowToMission);
}

export const pautasDoPortaVoz = getSpokespersonMissions;

export async function getSpokespersonMissionById(
  id: number,
  spokespersonId: number
): Promise<Mission | null> {
  const rows = await sql`
    ${BASE_SELECT} WHERE m.id = ${id} AND m.spokesperson_id = ${spokespersonId}
  `;
  const r = (rows as unknown as MissionRow[])[0];
  return r ? rowToMission(r) : null;
}

export const pautaPorIdDoPortaVoz = getSpokespersonMissionById;

export async function getQueuePosition(missionId: number): Promise<number> {
  const [row] = await sql`
    SELECT (
      SELECT COUNT(*)::int
      FROM missions before_m
      WHERE before_m.status = 'available'
        AND before_m.created_at <= m.created_at
        AND before_m.id <> m.id
    ) + 1 AS position,
    m.status
    FROM missions m
    WHERE m.id = ${missionId}
  `;
  if (!row) return 0;
  return row.status === "available" ? row.position : 0;
}

export const posicaoNaFila = getQueuePosition;

export async function getTotalInQueue(): Promise<number> {
  const [row] = await sql`
    SELECT COUNT(*)::int AS total FROM missions WHERE status = 'available'
  `;
  return row?.total ?? 0;
}

export const totalNaFila = getTotalInQueue;

export async function getAvailableMissions(): Promise<Mission[]> {
  const rows = await sql`
    ${BASE_SELECT} WHERE m.status = 'available'
    ORDER BY m.priority DESC, m.created_at ASC
  `;
  return (rows as unknown as MissionRow[]).map(rowToMission);
}

export const pautasDisponiveis = getAvailableMissions;

export async function getReservedMission(editorId: number): Promise<Mission | null> {
  try {
    const rows = await sql`
      ${BASE_SELECT}
      WHERE m.reserved_by_id = ${editorId}
        AND m.status IN ('reserved','in_review','revision_requested')
      LIMIT 1
    `;
    const r = (rows as unknown as MissionRow[])[0];
    return r ? rowToMission(r) : null;
  } catch {
    return null;
  }
}

export const pautaReservadaPor = getReservedMission;

export async function getApprovedDeliveries(editorId: number): Promise<Mission[]> {
  const rows = await sql`
    ${BASE_SELECT}
    WHERE m.reserved_by_id = ${editorId} AND m.status IN ('approved','completed')
    ORDER BY m.created_at DESC
  `;
  return (rows as unknown as MissionRow[]).map(rowToMission);
}

export const entregasAprovadas = getApprovedDeliveries;

export async function getPublicCandidateMissions(handle: string): Promise<Mission[]> {
  const rows = await sql`
    ${BASE_SELECT}
    WHERE lower(u.handle) = lower(${handle}) AND u.role = 'spokesperson' AND u.profile_completed = true
    ORDER BY m.created_at DESC
  `;
  return (rows as unknown as MissionRow[]).map(rowToMission);
}

export const pautasDoCandidatoPublico = getPublicCandidateMissions;

export async function getMissionsInReview(): Promise<Mission[]> {
  const rows = await sql`
    ${BASE_SELECT} WHERE m.status = 'in_review' ORDER BY m.created_at ASC
  `;
  return (rows as unknown as MissionRow[]).map(rowToMission);
}

export const pautasEmRevisao = getMissionsInReview;

export async function reserveMission(
  missionId: number,
  editorId: number
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const [locked] = await sql`
    SELECT booking_locked_until FROM users
    WHERE id = ${editorId} AND booking_locked_until > now()
  `;
  if (locked) return { ok: false, error: "You are temporarily restricted from claiming new missions.", erro: "You are temporarily restricted from claiming new missions." };

  const alreadyHas = await getReservedMission(editorId);
  if (alreadyHas) {
    return { ok: false, error: "You already have an active mission in progress. Deliver it before claiming another.", erro: "You already have an active mission." };
  }

  const rows = await sql`
    UPDATE missions
    SET status = 'reserved',
        reserved_by_id = ${editorId},
        reserved_at = now()
    WHERE id = ${missionId} AND status = 'available'
    RETURNING id
  `;
  if (rows.length === 0) {
    return { ok: false, error: "This mission was already claimed by another editor.", erro: "This mission was already claimed." };
  }
  return { ok: true };
}

export const reservarPauta = reserveMission;

export async function cancelReservation(
  missionId: number,
  editorId: number
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const rows = await sql`
    UPDATE missions
    SET status = 'available', reserved_by_id = NULL, reserved_at = NULL
    WHERE id = ${missionId} AND reserved_by_id = ${editorId}
      AND status IN ('reserved','revision_requested')
    RETURNING id
  `;
  if (rows.length === 0) return { ok: false, error: "This mission is not assigned to you.", erro: "This mission is not assigned to you." };
  return { ok: true };
}

export const cancelarReserva = cancelReservation;

export async function deliverMission(
  missionId: number,
  editorId: number,
  link: string
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  if (!isLikelyUrl(link) && !link.includes('r2.dev') && !link.includes('amazonaws.com') && !link.includes('storage.googleapis.com')) {
    return { ok: false, error: "Please paste a valid video URL or upload the video.", erro: "Please paste a valid video URL." };
  }

  const isVideoDeliveryUrl = link.includes('r2.dev') || link.includes('amazonaws.com') || link.includes('storage.googleapis.com');

  const rows = await sql`
    UPDATE missions
    SET status = 'in_review',
        delivery_link = ${!isVideoDeliveryUrl ? link.trim() : null},
        delivery_video_url = ${isVideoDeliveryUrl ? link.trim() : null},
        inspector_notes = NULL
    WHERE id = ${missionId} AND reserved_by_id = ${editorId}
      AND status IN ('reserved','revision_requested')
    RETURNING id
  `;
  if (rows.length === 0) return { ok: false, error: "This mission is not currently assigned to you.", erro: "This mission is not currently assigned to you." };
  return { ok: true };
}

export const entregarPauta = deliverMission;

export async function approveMission(
  missionId: number,
  approvedById: number,
  rating?: number,
  comment?: string,
  spokespersonId?: number
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const [mission] = spokespersonId
    ? await sql`
        SELECT reserved_by_id FROM missions
        WHERE id = ${missionId} AND status = 'in_review' AND spokesperson_id = ${spokespersonId}
      `
    : await sql`
        SELECT reserved_by_id FROM missions WHERE id = ${missionId} AND status = 'in_review'
      `;
  if (!mission?.reserved_by_id) return { ok: false, error: "This mission is not in review.", erro: "This mission is not in review." };
  const editorId = mission.reserved_by_id as number;

  if (rating !== undefined && (rating < 1 || rating > 5)) {
    return { ok: false, error: "Rating must be between 1 and 5.", erro: "Rating must be between 1 and 5." };
  }

  const finalStatus: MissionStatus = spokespersonId ? "completed" : "approved";

  const [result] = await sql`
    SELECT * FROM oficina_private.aprovar_edicao(
      ${missionId}, ${approvedById}, ${finalStatus}, ${rating ?? null}, ${comment?.trim() ?? ""}
    )
  `;
  if (result?.pontuou) await awardReferralIfEligible(editorId);

  return { ok: true };
}

export const aprovarPauta = approveMission;

export async function requestRevision(
  missionId: number,
  notes: string
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  if (!notes.trim()) return { ok: false, error: "Please describe what needs to be changed.", erro: "Please describe what needs to be changed." };

  const rows = await sql`
    UPDATE missions SET status = 'revision_requested', inspector_notes = ${notes.trim()},
                      revision_requested_by = 'inspector'
    WHERE id = ${missionId} AND status = 'in_review'
    RETURNING id
  `;
  if (rows.length === 0) return { ok: false, error: "This mission is not in review.", erro: "This mission is not in review." };
  return { ok: true };
}

export const pedirReedicao = requestRevision;

export async function acceptDelivery(
  missionId: number,
  spokespersonId: number
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const rows = await sql`
    UPDATE missions SET status = 'completed'
    WHERE id = ${missionId} AND spokesperson_id = ${spokespersonId} AND status = 'approved'
    RETURNING id
  `;
  if (rows.length === 0) {
    return { ok: false, error: "This mission is not awaiting your approval.", erro: "This mission is not awaiting your approval." };
  }
  return { ok: true };
}

export const aceitarEntrega = acceptDelivery;

export async function requestSpokespersonAdjustment(
  missionId: number,
  spokespersonId: number,
  notes: string
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  if (!notes.trim()) return { ok: false, error: "Please describe what needs to be adjusted.", erro: "Please describe what needs to be adjusted." };

  const rows = await sql`
    UPDATE missions SET status = 'revision_requested', inspector_notes = ${notes.trim()},
                      revision_requested_by = 'spokesperson'
    WHERE id = ${missionId} AND spokesperson_id = ${spokespersonId} AND status IN ('in_review', 'approved')
    RETURNING id
  `;
  if (rows.length === 0) {
    return { ok: false, error: "This mission is not awaiting your approval.", erro: "This mission is not awaiting your approval." };
  }
  return { ok: true };
}

export const pedirAjuste = requestSpokespersonAdjustment;

export async function deleteMission(
  missionId: number
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  await sql`
    UPDATE missions SET reserved_by_id = NULL WHERE id = ${missionId}
  `;
  const rows = await sql`
    DELETE FROM missions WHERE id = ${missionId} RETURNING id
  `;
  if (rows.length === 0) {
    return { ok: false, error: "Mission not found.", erro: "Mission not found." };
  }
  return { ok: true };
}

export const apagarPauta = deleteMission;

export async function getMissionContacts(missionId: number): Promise<{
  title: string;
  spokesperson: { name: string; email: string } | null;
  editor: { name: string; email: string } | null;
  // aliases
  titulo?: string;
  portaVoz?: { nome: string; email: string } | null;
} | null> {
  const [r] = await sql`
    SELECT m.title,
           v.name AS sp_name, v.email AS sp_email,
           e.name AS ed_name, e.email AS ed_email
    FROM missions m
    JOIN users v ON v.id = m.spokesperson_id
    LEFT JOIN users e ON e.id = m.reserved_by_id
    WHERE m.id = ${missionId}
  `;
  if (!r) return null;
  const sp = r.sp_email ? { name: String(r.sp_name), email: String(r.sp_email), nome: String(r.sp_name) } : null;
  const ed = r.ed_email ? { name: String(r.ed_name), email: String(r.ed_email), nome: String(r.ed_name) } : null;
  return {
    title: String(r.title),
    spokesperson: sp,
    editor: ed,
    titulo: String(r.title),
    portaVoz: sp,
  };
}

export const contatosDaPauta = getMissionContacts;

export const acceptDeliveredMission = acceptDelivery;
export const requestInspectorReEdit = requestRevision;
export const cancelMissionReservation = cancelReservation;
export const missionContacts = getMissionContacts;

export const spokespersonMissions = getSpokespersonMissions;
export const missionByIdOfSpokesperson = getSpokespersonMissionById;
export const queuePosition = getQueuePosition;
export const totalInQueue = getTotalInQueue;
export const availableMissions = getAvailableMissions;
export const reservedMissionBy = getReservedMission;
export const missionReservedBy = getReservedMission;
export const approvedDeliveries = getApprovedDeliveries;
export const publicCandidateMissions = getPublicCandidateMissions;
export const missionsInReview = getMissionsInReview;

export const deleteMissionPermanently = deleteMission;
