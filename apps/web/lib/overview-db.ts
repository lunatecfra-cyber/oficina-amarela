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
  const [p] = await sql`
    SELECT
      count(*) FILTER (WHERE status = 'disponivel')::int  AS na_fila,
      count(*) FILTER (WHERE status = 'oferecida')::int   AS oferecidas,
      count(*) FILTER (WHERE status = 'reservada')::int   AS em_edicao,
      count(*) FILTER (WHERE status = 'em_revisao')::int  AS em_conferencia,
      count(*) FILTER (WHERE status = 'reedicao')::int    AS em_reedicao,
      count(*) FILTER (WHERE status IN ('aprovada','finalizada'))::int AS concluidas
    FROM pautas
  `;

  const [u] = await sql`
    SELECT
      count(*) FILTER (WHERE papel IN ('voz', 'spokesperson') AND banido = false)::int    AS candidatos,
      count(*) FILTER (WHERE papel = 'editor' AND banido = false)::int                     AS editores,
      count(*) FILTER (WHERE banido = true)::int                                           AS banidos,
      count(*) FILTER (
        WHERE papel = 'editor' AND banido = false AND perfil_completo = true
          AND NOT EXISTS (
            SELECT 1 FROM pautas p
            WHERE p.reservada_por_id = users.id
              AND p.status IN ('reservada','em_revisao','reedicao')
          )
          AND NOT EXISTS (
            SELECT 1 FROM ofertas o WHERE o.editor_id = users.id AND o.status = 'pendente'
          )
      )::int AS editores_livres
    FROM users
  `;

  const inQueue = Number(p?.na_fila ?? 0);
  const offered = Number(p?.oferecidas ?? 0);
  const inEditing = Number(p?.em_edicao ?? 0);
  const inReview = Number(p?.em_conferencia ?? 0);
  const inRevision = Number(p?.em_reedicao ?? 0);
  const completed = Number(p?.concluidas ?? 0);
  const spokespersons = Number(u?.candidatos ?? 0);
  const editors = Number(u?.editores ?? 0);
  const freeEditors = Number(u?.editores_livres ?? 0);
  const banned = Number(u?.banidos ?? 0);

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
    SELECT p.id, p.titulo, p.formato, p.criada_em, p.prioridade, p.status,
           v.nome AS candidato,
           e.apelido AS oferecida_para,
           o.oferecida_em
    FROM pautas p
    JOIN users v ON v.id = p.porta_voz_id
    LEFT JOIN ofertas o ON o.pauta_id = p.id AND o.status = 'pendente'
    LEFT JOIN users e ON e.id = o.editor_id
    WHERE p.status IN ('disponivel','oferecida')
    ORDER BY p.prioridade DESC, p.criada_em ASC
  `;
  return rows.map((l) => ({
    id: l.id,
    title: l.titulo,
    format: l.formato,
    spokesperson: l.candidato,
    candidateName: l.candidato,
    createdAt: new Date(l.criada_em).toISOString(),
    priority: l.prioridade,
    status: l.status,
    offeredTo: l.oferecida_para ?? null,
    offeredAt: l.oferecida_em ? new Date(l.oferecida_em).toISOString() : null,
    titulo: l.titulo,
    formato: l.formato,
    candidato: l.candidato,
    criadaEm: new Date(l.criada_em).toISOString(),
    prioridade: l.prioridade,
    oferecidaPara: l.oferecida_para ?? null,
    oferecidaEm: l.oferecida_em ? new Date(l.oferecida_em).toISOString() : null,
  }));
}

export const editingQueue = getEditingQueue;
export const filaDeEdicao = getEditingQueue;

export async function getMissionsInFlight(): Promise<MissionInFlight[]> {
  const rows = await sql`
    SELECT p.id, p.titulo, p.status, p.reservada_em, p.entrega_link,
           v.nome AS candidato, e.apelido AS editor
    FROM pautas p
    JOIN users v ON v.id = p.porta_voz_id
    LEFT JOIN users e ON e.id = p.reservada_por_id
    WHERE p.status IN ('reservada','em_revisao','reedicao')
    ORDER BY p.reservada_em ASC NULLS LAST
  `;
  return rows.map((l) => ({
    id: l.id,
    title: l.titulo,
    status: l.status,
    spokesperson: l.candidato,
    candidateName: l.candidato,
    editor: l.editor ?? null,
    since: l.reservada_em ? new Date(l.reservada_em).toISOString() : null,
    hasDelivery: Boolean(l.entrega_link),
    titulo: l.titulo,
    candidato: l.candidato,
    desde: l.reservada_em ? new Date(l.reservada_em).toISOString() : null,
    temEntrega: Boolean(l.entrega_link),
  }));
}

export const missionsInFlight = getMissionsInFlight;
export const missoesEmVoo = getMissionsInFlight;

export type QueueMove = "up" | "down" | "top" | "subir" | "descer" | "topo";
export type Movimento = QueueMove;

export async function moveInQueue(
  missionId: number,
  movement: QueueMove,
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const queue = await sql`
    SELECT id FROM pautas
    WHERE status IN ('disponivel','oferecida')
    ORDER BY prioridade DESC, criada_em ASC
  `;
  const ids: number[] = queue.map((l) => l.id);

  const fromIdx = ids.indexOf(missionId);
  if (fromIdx === -1)
    return {
      ok: false,
      error: "Essa missão não está mais na fila.",
      erro: "Essa missão não está mais na fila.",
    };

  const toIdx =
    movement === "top" || movement === "topo"
      ? 0
      : movement === "up" || movement === "subir"
        ? fromIdx - 1
        : fromIdx + 1;

  if (toIdx < 0 || toIdx >= ids.length) {
    return {
      ok: false,
      error: "Ela já está nessa ponta da fila.",
      erro: "Ela já está nessa ponta da fila.",
    };
  }

  ids.splice(fromIdx, 1);
  ids.splice(toIdx, 0, missionId);

  const priorities = ids.map((_, i) => ids.length - i);

  await sql`
    UPDATE pautas SET prioridade = v.prio
    FROM (
      SELECT unnest(${ids}::int[]) AS id,
             unnest(${priorities}::int[]) AS prio
    ) v
    WHERE pautas.id = v.id
  `;

  return { ok: true };
}

export const moveQueue = moveInQueue;
export const moverNaFila = moveInQueue;

export async function getActiveEditorEmails(): Promise<
  { name: string; email: string; nome?: string }[]
> {
  const rows = await sql`
    SELECT nome, email FROM users
    WHERE papel = 'editor' AND banido = false
    ORDER BY nome ASC
  `;
  return rows.map((l) => ({ name: String(l.nome), email: String(l.email), nome: String(l.nome) }));
}

export const emailsDosEditores = getActiveEditorEmails;

export async function getActiveSpokespersonEmails(): Promise<
  { name: string; email: string; nome?: string }[]
> {
  const rows = await sql`
    SELECT nome, email FROM users
    WHERE papel IN ('voz', 'spokesperson') AND banido = false
    ORDER BY nome ASC
  `;
  return rows.map((l) => ({ name: String(l.nome), email: String(l.email), nome: String(l.nome) }));
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
