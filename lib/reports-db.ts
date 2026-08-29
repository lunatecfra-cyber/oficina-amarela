import { sql } from "@/lib/db";
import { LIMITS, limitStr } from "@/lib/limits";
import type { UserSession } from "@/lib/session";

export type Report = {
  id: number;
  missionId: number;
  missionTitle: string;
  missionStatus: string;
  reporterId: number;
  reporterName: string;
  reporterHandle: string;
  reportedId: number | null;
  reportedName: string | null;
  reportedHandle: string | null;
  text: string;
  status: "open" | "resolved" | "ignored" | "aberta" | "resolvida" | "ignorada";
  createdAt: string;
  // aliases
  pautaId?: number;
  pautaTitulo?: string;
  pautaStatus?: string;
  denuncianteId?: number;
  denuncianteNome?: string;
  denuncianteApelido?: string;
  denunciadoId?: number | null;
  denunciadoNome?: string | null;
  denunciadoApelido?: string | null;
  texto?: string;
  criadaEm?: string;
};

export type Denuncia = Report;

export async function createReport(
  missionId: number,
  session: UserSession,
  rawText: string
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const text = limitStr(rawText, LIMITS.report);
  if (!text) {
    return { ok: false, error: "Report text cannot be empty.", erro: "O relato não pode ficar em branco." };
  }

  const [mission] = await sql`
    SELECT id, spokesperson_id, reserved_by_id FROM missions WHERE id = ${missionId}
  `;
  if (!mission) {
    return { ok: false, error: "Mission not found.", erro: "Missão não encontrada." };
  }

  let reportedId: number | null = null;
  if (session.id === mission.spokesperson_id) {
    reportedId = mission.reserved_by_id ?? null;
  } else if (session.id === mission.reserved_by_id) {
    reportedId = mission.spokesperson_id;
  }

  await sql`
    INSERT INTO reports (mission_id, reporter_id, reported_id, text)
    VALUES (${missionId}, ${session.id}, ${reportedId}, ${text})
  `;

  return { ok: true };
}

export const criarDenuncia = createReport;

type ReportRow = {
  id: number;
  mission_id: number;
  mission_title: string;
  mission_status: string;
  reporter_id: number;
  reporter_name: string;
  reporter_handle: string;
  reported_id: number | null;
  reported_name: string | null;
  reported_handle: string | null;
  text: string;
  status: "open" | "resolved" | "ignored";
  created_at: string;
};

function rowToReport(r: ReportRow): Report {
  return {
    id: r.id,
    missionId: r.mission_id,
    missionTitle: r.mission_title,
    missionStatus: r.mission_status,
    reporterId: r.reporter_id,
    reporterName: r.reporter_name,
    reporterHandle: r.reporter_handle,
    reportedId: r.reported_id,
    reportedName: r.reported_name,
    reportedHandle: r.reported_handle,
    text: r.text,
    status: r.status,
    createdAt: r.created_at,
    // aliases
    pautaId: r.mission_id,
    pautaTitulo: r.mission_title,
    pautaStatus: r.mission_status,
    denuncianteId: r.reporter_id,
    denuncianteNome: r.reporter_name,
    denuncianteApelido: r.reporter_handle,
    denunciadoId: r.reported_id,
    denunciadoNome: r.reported_name,
    denunciadoApelido: r.reported_handle,
    texto: r.text,
    criadaEm: r.created_at,
  };
}

const SELECT_REPORTS = sql`
  SELECT r.id, r.mission_id, r.text, r.status, r.created_at,
         m.title AS mission_title, m.status AS mission_status,
         u1.name AS reporter_name, u1.handle AS reporter_handle, u1.id AS reporter_id,
         u2.name AS reported_name, u2.handle AS reported_handle, u2.id AS reported_id
  FROM reports r
  JOIN missions m ON m.id = r.mission_id
  JOIN users u1 ON u1.id = r.reporter_id
  LEFT JOIN users u2 ON u2.id = r.reported_id
`;

export async function reportsForInspector(): Promise<Report[]> {
  const rows = await sql`${SELECT_REPORTS}
    ORDER BY
      CASE WHEN r.status = 'open' THEN 0 ELSE 1 END,
      r.created_at DESC
  `;
  return (rows as unknown as ReportRow[]).map(rowToReport);
}

export const denunciasParaInspetor = reportsForInspector;

export async function resolveReport(
  id: number,
  status: "resolved" | "ignored" | "resolvida" | "ignorada"
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const normStatus = status === "resolvida" ? "resolved" : status === "ignorada" ? "ignored" : status;
  const rows = await sql`
    UPDATE reports SET status = ${normStatus}
    WHERE id = ${id}
    RETURNING id
  `;
  if (rows.length === 0) {
    return { ok: false, error: "Denúncia não encontrada.", erro: "Denúncia não encontrada." };
  }
  return { ok: true };
}

export const resolverDenuncia = resolveReport;

export const createModerationReport = createReport;

export const resolveModerationReport = resolveReport;
