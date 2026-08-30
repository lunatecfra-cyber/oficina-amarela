import { sql } from "@/lib/db";

export type SystemOverview = {
  inQueue: number;
  offered: number;
  inEditing: number;
  inReview: number;
  inRevision: number;
  inReedit?: number;
  completed: number;
  spokespersons: number;
  candidates?: number;
  editors: number;
  freeEditors: number;
  banned: number;
  // aliases
  naFila?: number;
  oferecidas?: number;
  emEdicao?: number;
  emConferencia?: number;
  emReedicao?: number;
  concluidas?: number;
  candidatos?: number;
  editores?: number;
  editoresLivres?: number;
  banidos?: number;
};
export type Summary = SystemOverview;
export type Resumo = SystemOverview;

export type QueueItem = {
  id: number;
  title: string;
  format: string;
  spokesperson: string;
  candidateName?: string;
  createdAt: string;
  priority: number;
  status: string;
  offeredTo: string | null;
  offeredAt: string | null;
  // aliases
  titulo?: string;
  formato?: string;
  candidato?: string;
  criadaEm?: string;
  prioridade?: number;
  oferecidaPara?: string | null;
  oferecidaEm?: string | null;
};
export type ItemFila = QueueItem;

export type MissionInFlight = {
  id: number;
  title: string;
  status: string;
  spokesperson: string;
  candidateName?: string;
  editor: string | null;
  since: string | null;
  hasDelivery: boolean;
  // aliases
  titulo?: string;
  candidato?: string;
  desde?: string | null;
  temEntrega?: boolean;
};
export type MissaoEmVoo = MissionInFlight;

export async function getSystemOverview(): Promise<SystemOverview> {
  const [counts] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'available') AS in_queue,
      COUNT(*) FILTER (WHERE status = 'offered') AS offered,
      COUNT(*) FILTER (WHERE status = 'reserved') AS in_editing,
      COUNT(*) FILTER (WHERE status = 'in_review') AS in_review,
      COUNT(*) FILTER (WHERE status = 'revision_requested' OR status = 'reedit') AS in_revision,
      COUNT(*) FILTER (WHERE status = 'approved' OR status = 'completed' OR status = 'finished') AS completed
    FROM missions
  `;

  const [users] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE role = 'spokesperson' AND is_banned = false) AS spokespersons,
      COUNT(*) FILTER (WHERE role = 'editor' AND is_banned = false) AS editors,
      COUNT(*) FILTER (WHERE is_banned = true) AS banned
    FROM users
  `;

  const [free] = await sql`
    SELECT COUNT(*) AS free_editors
    FROM users u
    WHERE u.role = 'editor'
      AND u.is_banned = false
      AND NOT EXISTS (
        SELECT 1 FROM missions m
        WHERE m.reserved_by_id = u.id
          AND m.status IN ('reserved', 'in_review', 'revision_requested', 'reedit')
      )
  `;

  // `?.` e não `.`: sem DATABASE_URL o wrapper de lib/db.ts devolve `[]` em
  // toda query, então o destructuring acima entrega `undefined` e o acesso
  // direto derrubava a página inteira ("Cannot read properties of undefined").
  // Com o banco ligado nada muda; sem ele, o Panorama abre zerado em vez de
  // quebrar — que é como o resto do sistema se comporta localmente.
  const inQueue = Number(counts?.in_queue ?? 0);
  const offered = Number(counts?.offered ?? 0);
  const inEditing = Number(counts?.in_editing ?? 0);
  const inReview = Number(counts?.in_review ?? 0);
  const inRevision = Number(counts?.in_revision ?? 0);
  const completed = Number(counts?.completed ?? 0);
  const spokespersons = Number(users?.spokespersons ?? 0);
  const editors = Number(users?.editors ?? 0);
  const freeEditors = Number(free?.free_editors ?? 0);
  const banned = Number(users?.banned ?? 0);

  return {
    inQueue,
    offered,
    inEditing,
    inReview,
    inRevision,
    inReedit: inRevision,
    completed,
    spokespersons,
    candidates: spokespersons,
    editors,
    freeEditors,
    banned,
    naFila: inQueue,
    oferecidas: offered,
    emEdicao: inEditing,
    emConferencia: inReview,
    emReedicao: inRevision,
    concluidas: completed,
    candidatos: spokespersons,
    editores: editors,
    editoresLivres: freeEditors,
    banidos: banned,
  };
}

export const systemSummary = getSystemOverview;
export const resumoDoSistema = getSystemOverview;

export async function getEditingQueue(): Promise<QueueItem[]> {
  const rows = await sql`
    SELECT m.id, m.title, m.format, m.created_at, m.priority, m.status,
           v.name AS spokesperson,
           e.handle AS offered_to,
           m.offered_at
    FROM missions m
    JOIN users v ON v.id = m.spokesperson_id
    LEFT JOIN users e ON e.id = m.offered_to_id
    WHERE m.status IN ('available', 'offered')
    ORDER BY m.priority DESC, m.created_at ASC
  `;
  return rows.map((l) => ({
    id: l.id,
    title: l.title,
    format: l.format,
    spokesperson: l.spokesperson,
    candidateName: l.spokesperson,
    createdAt: new Date(l.created_at).toISOString(),
    priority: l.priority,
    status: l.status,
    offeredTo: l.offered_to ?? null,
    offeredAt: l.offered_at ? new Date(l.offered_at).toISOString() : null,
    titulo: l.title,
    formato: l.format,
    candidato: l.spokesperson,
    criadaEm: new Date(l.created_at).toISOString(),
    prioridade: l.priority,
    oferecidaPara: l.offered_to ?? null,
    oferecidaEm: l.offered_at ? new Date(l.offered_at).toISOString() : null,
  }));
}

export const editingQueue = getEditingQueue;
export const filaDeEdicao = getEditingQueue;

export async function getMissionsInFlight(): Promise<MissionInFlight[]> {
  const rows = await sql`
    SELECT m.id, m.title, m.status, m.reserved_at, m.delivery_link,
           v.name AS spokesperson, e.handle AS editor
    FROM missions m
    JOIN users v ON v.id = m.spokesperson_id
    LEFT JOIN users e ON e.id = m.reserved_by_id
    WHERE m.status IN ('reserved','in_review','revision_requested','reedit')
    ORDER BY m.reserved_at ASC NULLS LAST
  `;
  return rows.map((l) => ({
    id: l.id,
    title: l.title,
    status: l.status,
    spokesperson: l.spokesperson,
    candidateName: l.spokesperson,
    editor: l.editor ?? null,
    since: l.reserved_at ? new Date(l.reserved_at).toISOString() : null,
    hasDelivery: Boolean(l.delivery_link),
    titulo: l.title,
    candidato: l.spokesperson,
    desde: l.reserved_at ? new Date(l.reserved_at).toISOString() : null,
    temEntrega: Boolean(l.delivery_link),
  }));
}

export const missionsInFlight = getMissionsInFlight;
export const missoesEmVoo = getMissionsInFlight;

export type QueueMove = "up" | "down" | "top" | "subir" | "descer" | "topo";
export type Movimento = QueueMove;

export async function moveInQueue(
  missionId: number,
  movement: QueueMove
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const queue = await sql`
    SELECT id FROM missions
    WHERE status IN ('available','offered')
    ORDER BY priority DESC, created_at ASC
  `;
  const ids: number[] = queue.map((l) => l.id);

  const fromIdx = ids.indexOf(missionId);
  if (fromIdx === -1) return { ok: false, error: "This mission is no longer in the queue.", erro: "This mission is no longer in the queue." };

  const toIdx =
    movement === "top" || movement === "topo"
      ? 0
      : movement === "up" || movement === "subir"
        ? fromIdx - 1
        : fromIdx + 1;

  if (toIdx < 0 || toIdx >= ids.length) {
    return { ok: false, error: "Mission is already at that boundary.", erro: "Mission is already at that boundary." };
  }

  ids.splice(fromIdx, 1);
  ids.splice(toIdx, 0, missionId);

  const priorities = ids.map((_, i) => ids.length - i);

  await sql`
    UPDATE missions SET priority = v.prio
    FROM (
      SELECT unnest(${ids}::int[]) AS id,
             unnest(${priorities}::int[]) AS prio
    ) v
    WHERE missions.id = v.id
  `;

  return { ok: true };
}

export const moveQueue = moveInQueue;
export const moverNaFila = moveInQueue;

export async function getActiveEditorEmails(): Promise<{ name: string; email: string; nome?: string }[]> {
  const rows = await sql`
    SELECT name, email FROM users
    WHERE role = 'editor' AND is_banned = false
    ORDER BY name ASC
  `;
  return rows.map((l) => ({ name: String(l.name), email: String(l.email), nome: String(l.name) }));
}

export const emailsDosEditores = getActiveEditorEmails;

export async function getActiveSpokespersonEmails(): Promise<{ name: string; email: string; nome?: string }[]> {
  const rows = await sql`
    SELECT name, email FROM users
    WHERE role = 'spokesperson' AND is_banned = false
    ORDER BY name ASC
  `;
  return rows.map((l) => ({ name: String(l.name), email: String(l.email), nome: String(l.name) }));
}

export const emailsDosCandidatos = getActiveSpokespersonEmails;

export const systemOverviewSummary = getSystemOverview;
export const systemOverview = getSystemOverview;
export const editorNotificationEmails = getActiveEditorEmails;
export const candidateNotificationEmails = getActiveSpokespersonEmails;
export const editorEmails = getActiveEditorEmails;
export const candidateEmails = getActiveSpokespersonEmails;
export const spokespersonEmails = getActiveSpokespersonEmails;

export type QueueMovement = QueueMove;
