import { LIMITS, limitStr } from "@oficina/domain/limits";
import { sql } from "@/lib/db";
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
  rawText: string,
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const text = limitStr(rawText, LIMITS.report);
  if (!text) {
    return {
      ok: false,
      error: "O relato não pode ficar em branco.",
      erro: "O relato não pode ficar em branco.",
    };
  }

  const [mission] = await sql`
    SELECT id, porta_voz_id, reservada_por_id FROM pautas WHERE id = ${missionId}
  `;
  if (!mission) {
    return { ok: false, error: "Missão não encontrada.", erro: "Missão não encontrada." };
  }

  let reportedId: number | null = null;
  if (session.id === mission.porta_voz_id) {
    reportedId = mission.reservada_por_id ?? null;
  } else if (session.id === mission.reservada_por_id) {
    reportedId = mission.porta_voz_id;
  }

  await sql`
    INSERT INTO denuncias (pauta_id, denunciante_id, denunciado_id, texto)
    VALUES (${missionId}, ${session.id}, ${reportedId}, ${text})
  `;

  return { ok: true };
}

export const criarDenuncia = createReport;

type ReportRow = {
  id: number;
  pauta_id: number;
  pauta_titulo: string;
  pauta_status: string;
  denunciante_id: number;
  denunciante_nome: string;
  denunciante_apelido: string;
  denunciado_id: number | null;
  denunciado_nome: string | null;
  denunciado_apelido: string | null;
  texto: string;
  status: "aberta" | "resolvida" | "ignorada";
  criada_em: string;
};

function rowToReport(r: ReportRow): Report {
  const statusMap: Record<string, "open" | "resolved" | "ignored"> = {
    aberta: "open",
    resolvida: "resolved",
    ignorada: "ignored",
  };
  const normStatus = statusMap[r.status] ?? "open";

  return {
    id: r.id,
    missionId: r.pauta_id,
    missionTitle: r.pauta_titulo,
    missionStatus: r.pauta_status,
    reporterId: r.denunciante_id,
    reporterName: r.denunciante_nome,
    reporterHandle: r.denunciante_apelido,
    reportedId: r.denunciado_id,
    reportedName: r.denunciado_nome,
    reportedHandle: r.denunciado_apelido,
    text: r.texto,
    status: normStatus,
    createdAt: r.criada_em,
    // aliases
    pautaId: r.pauta_id,
    pautaTitulo: r.pauta_titulo,
    pautaStatus: r.pauta_status,
    denuncianteId: r.denunciante_id,
    denuncianteNome: r.denunciante_nome,
    denuncianteApelido: r.denunciante_apelido,
    denunciadoId: r.denunciado_id,
    denunciadoNome: r.denunciado_nome,
    denunciadoApelido: r.denunciado_apelido,
    texto: r.texto,
    criadaEm: r.criada_em,
  };
}

const SELECT_REPORTS = sql`
  SELECT r.id, r.pauta_id, r.texto, r.status, r.criada_em,
         p.titulo AS pauta_titulo, p.status AS pauta_status,
         u1.nome AS denunciante_nome, u1.apelido AS denunciante_apelido, u1.id AS denunciante_id,
         u2.nome AS denunciado_nome, u2.apelido AS denunciado_apelido, u2.id AS denunciado_id
  FROM denuncias r
  JOIN pautas p ON p.id = r.pauta_id
  JOIN users u1 ON u1.id = r.denunciante_id
  LEFT JOIN users u2 ON u2.id = r.denunciado_id
`;

export async function reportsForInspector(): Promise<Report[]> {
  const rows = await sql`${SELECT_REPORTS}
    ORDER BY
      CASE WHEN r.status = 'aberta' THEN 0 ELSE 1 END,
      r.criada_em DESC
  `;
  return (rows as unknown as ReportRow[]).map(rowToReport);
}

export const denunciasParaInspetor = reportsForInspector;

export async function resolveReport(
  id: number,
  status: "resolved" | "ignored" | "resolvida" | "ignorada",
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const normStatus = status === "resolved" || status === "resolvida" ? "resolvida" : "ignorada";
  const rows = await sql`
    UPDATE denuncias SET status = ${normStatus}, resolvida_em = now()
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
