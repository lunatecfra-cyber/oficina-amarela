import { LIMITS, limitOrNull, limitStr } from "@oficina/domain/limits";
import type { Mission, MissionStatus, VideoFormat } from "@oficina/domain/missions";
import { sql } from "./client.ts";

export type CreateMissionInput = {
  spokespersonId: number;
  title: string;
  format: VideoFormat;
  driveLink?: string | null;
  youtubeLink?: string | null;
  tone?: string | null;
  color?: string | null;
  font?: string | null;
  refs?: string | null;
  extras?: string | null;
  motivation?: string | null;
  desiredDeadline?: string | null;
  deadline?: string | null;
  rawVideoUrl?: string | null;
  rawFootageUrl?: string | null;
  watermark?: string | null;
  watermarkUrl?: string | null;
  campaignTaxId?: string | null;
  voterId?: string | null;
  voterRegistrationId?: string | null;
  // PT-BR aliases
  portaVozId?: number;
  titulo?: string;
  formato?: VideoFormat;
  tom?: string | null;
  cor?: string | null;
  fonte?: string | null;
  motivo?: string | null;
  prazo?: string | null;
  prazoDesejado?: string | null;
  videoBrutoUrl?: string | null;
  marcaDagua?: string | null;
  cnpjCampanha?: string | null;
  tituloEleitor?: string | null;
};

export type MissionRow = {
  id: number;
  porta_voz_nome: string;
  porta_voz_apelido: string;
  titulo: string;
  formato: VideoFormat;
  brief_tom: string | null;
  brief_cor: string | null;
  brief_fonte: string | null;
  brief_refs: string | null;
  drive_link: string | null;
  youtube_link: string | null;
  status: MissionStatus;
  reservada_por_apelido: string | null;
  reservada_ate: string | null;
  reservada_em: string | null;
  entrega_link: string | null;
  notas_inspetor: string | null;
  criada_em: string;
  extras: string | null;
  motivo: string | null;
  prazo_desejado: Date | string | null;
  reedicao_pedida_por: "inspetor" | "porta_voz" | "inspector" | "spokesperson" | null;
  video_bruto_url: string | null;
  video_entrega_url: string | null;
  marca_dagua: string | null;
  cnpj_campanha: string | null;
  titulo_eleitor: string | null;
};

export function rowToMission(r: MissionRow): Mission {
  const desiredDeadlineStr = r.prazo_desejado
    ? new Date(r.prazo_desejado).toISOString().slice(0, 10)
    : undefined;

  const revBy =
    r.reedicao_pedida_por === "inspetor" || r.reedicao_pedida_por === "inspector"
      ? "inspector"
      : r.reedicao_pedida_por === "porta_voz" || r.reedicao_pedida_por === "spokesperson"
        ? "spokesperson"
        : undefined;

  return {
    id: `db-${r.id}`,
    spokesperson: r.porta_voz_nome,
    spokespersonHandle: r.porta_voz_apelido,
    title: r.titulo,
    format: r.formato,
    brief: {
      tone: r.brief_tom ?? undefined,
      color: r.brief_cor ?? undefined,
      font: r.brief_fonte ?? undefined,
      refs: r.brief_refs ?? undefined,
      tom: r.brief_tom ?? undefined,
      cor: r.brief_cor ?? undefined,
      fonte: r.brief_fonte ?? undefined,
    },
    status: r.status,
    createdAt: new Date(r.criada_em).toISOString(),
    reservedBy: r.reservada_por_apelido ?? undefined,
    reservedAt: r.reservada_em ? new Date(r.reservada_em).toISOString() : undefined,
    driveLink: r.drive_link ?? undefined,
    youtubeLink: r.youtube_link ?? undefined,
    deliveryLink: r.entrega_link ?? undefined,
    inspectorNotes: r.notas_inspetor ?? undefined,
    extras: r.extras ?? undefined,
    motivation: r.motivo ?? undefined,
    desiredDeadline: desiredDeadlineStr,
    revisionRequestedBy: revBy,
    rawVideoUrl: r.video_bruto_url ?? undefined,
    deliveryVideoUrl: r.video_entrega_url ?? undefined,
    watermark: r.marca_dagua ?? undefined,
    campaignTaxId: r.cnpj_campanha ?? undefined,
    voterId: r.titulo_eleitor ?? undefined,
    // compatibility aliases
    portaVoz: r.porta_voz_nome,
    portaVozApelido: r.porta_voz_apelido,
    titulo: r.titulo,
    formato: r.formato,
    criadaEm: new Date(r.criada_em).toISOString(),
    reservadaPor: r.reservada_por_apelido ?? undefined,
    reservadaEm: r.reservada_em ? new Date(r.reservada_em).toISOString() : undefined,
    entregaLink: r.entrega_link ?? undefined,
    notasInspetor: r.notas_inspetor ?? undefined,
    motivo: r.motivo ?? undefined,
    prazoDesejado: desiredDeadlineStr,
    reedicaoPedidaPor: r.reedicao_pedida_por ?? undefined,
    videoBrutoUrl: r.video_bruto_url ?? undefined,
    videoEntregaUrl: r.video_entrega_url ?? undefined,
    marcaDagua: r.marca_dagua ?? undefined,
    cnpjCampanha: r.cnpj_campanha ?? undefined,
    tituloEleitor: r.titulo_eleitor ?? undefined,
  };
}

export type MissionsRepository = {
  createMission(
    data: CreateMissionInput,
  ): Promise<{ ok: true; id: number } | { ok: false; error: string; erro?: string }>;
  getMissionById(id: number): Promise<Mission | null>;
  getSpokespersonMissions(spokespersonId: number): Promise<Mission[]>;
  getSpokespersonMissionById(id: number, spokespersonId: number): Promise<Mission | null>;
  getAvailableMissions(): Promise<Mission[]>;
  getMissionsInReview(): Promise<Mission[]>;
  getReservedMission(editorId: number): Promise<Mission | null>;
  getApprovedDeliveries(editorId: number): Promise<Mission[]>;
  getPublicCandidateMissions(handle: string): Promise<Mission[]>;
  getQueuePosition(missionId: number): Promise<number>;
  getTotalInQueue(): Promise<number>;
  deleteMission(
    missionId: number,
  ): Promise<{ ok: true } | { ok: false; error: string; erro?: string }>;
  listAllMissions(): Promise<Mission[]>;
};

const baseSelect = () => sql`
  SELECT p.id, u.nome AS porta_voz_nome, u.apelido AS porta_voz_apelido, p.titulo, p.formato,
         p.brief_tom, p.brief_cor, p.brief_fonte, p.brief_refs,
         p.drive_link, p.youtube_link, p.status, p.reservada_ate, p.reservada_em, p.entrega_link,
         p.notas_inspetor, p.criada_em,
         p.extras, p.motivo, p.prazo_desejado, p.reedicao_pedida_por,
         p.video_bruto_url, p.video_entrega_url, p.marca_dagua, p.cnpj_campanha, p.titulo_eleitor,
         e.apelido AS reservada_por_apelido
  FROM pautas p
  JOIN users u ON u.id = p.porta_voz_id
  LEFT JOIN users e ON e.id = p.reservada_por_id
`;

export const postgresMissions: MissionsRepository = {
  async createMission(data) {
    const spokespersonId = data.spokespersonId ?? data.portaVozId;
    const rawTitle = data.title ?? data.titulo;
    const rawFormat = data.format ?? data.formato;

    if (!spokespersonId) {
      return {
        ok: false,
        error: "ID do porta-voz obrigatório.",
        erro: "ID do porta-voz obrigatório.",
      };
    }
    const title = limitStr(rawTitle, LIMITS.title);
    if (!title) {
      return { ok: false, error: "Dê um título pra missão.", erro: "Dê um título pra missão." };
    }
    if (rawFormat !== "short" && rawFormat !== "long" && (rawFormat as string) !== "longo") {
      return { ok: false, error: "Escolha o formato.", erro: "Escolha o formato." };
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
      deadline: limitOrNull(
        data.deadline ?? data.prazo ?? data.desiredDeadline ?? data.prazoDesejado,
        10,
      ),
      rawVideoUrl: limitOrNull(
        data.rawVideoUrl ?? data.rawFootageUrl ?? data.videoBrutoUrl,
        LIMITS.link,
      ),
      watermark: limitOrNull(
        data.watermark ?? data.watermarkUrl ?? data.marcaDagua,
        LIMITS.briefField,
      ),
      campaignTaxId: limitOrNull(data.campaignTaxId ?? data.cnpjCampanha, LIMITS.briefField),
      voterId: limitOrNull(
        data.voterId ?? data.voterRegistrationId ?? data.tituloEleitor,
        LIMITS.briefField,
      ),
    };

    const dbFormato = rawFormat === "long" ? "longo" : rawFormat;

    const [row] = await sql`
      INSERT INTO pautas (porta_voz_id, titulo, formato, drive_link, youtube_link,
                          brief_tom, brief_cor, brief_fonte, brief_refs,
                          extras, motivo, prazo_desejado, video_bruto_url,
                          marca_dagua, cnpj_campanha, titulo_eleitor)
      VALUES (${spokespersonId}, ${title}, ${dbFormato},
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
  },

  async getMissionById(id) {
    const rows = await sql`${baseSelect()} WHERE p.id = ${id}`;
    const row = (rows as unknown as MissionRow[])[0];
    return row ? rowToMission(row) : null;
  },

  async getSpokespersonMissions(spokespersonId) {
    const rows =
      await sql`${baseSelect()} WHERE p.porta_voz_id = ${spokespersonId} ORDER BY p.criada_em DESC`;
    return (rows as unknown as MissionRow[]).map(rowToMission);
  },

  async getSpokespersonMissionById(id, spokespersonId) {
    const rows =
      await sql`${baseSelect()} WHERE p.id = ${id} AND p.porta_voz_id = ${spokespersonId}`;
    const row = (rows as unknown as MissionRow[])[0];
    return row ? rowToMission(row) : null;
  },

  async getAvailableMissions() {
    const rows =
      await sql`${baseSelect()} WHERE p.status = 'disponivel' ORDER BY p.prioridade DESC, p.criada_em ASC`;
    return (rows as unknown as MissionRow[]).map(rowToMission);
  },

  async getMissionsInReview() {
    const rows = await sql`${baseSelect()} WHERE p.status = 'em_revisao' ORDER BY p.criada_em ASC`;
    return (rows as unknown as MissionRow[]).map(rowToMission);
  },

  async getReservedMission(editorId) {
    const rows = await sql`
      ${baseSelect()}
      WHERE p.reservada_por_id = ${editorId}
        AND p.status IN ('reservada', 'em_revisao', 'reedicao', 'aprovada')
      ORDER BY p.reservada_em DESC
      LIMIT 1
    `;
    const row = (rows as unknown as MissionRow[])[0];
    return row ? rowToMission(row) : null;
  },

  async getApprovedDeliveries(editorId) {
    const rows = await sql`
      ${baseSelect()} WHERE p.reservada_por_id = ${editorId} AND p.status IN ('aprovada', 'finalizada')
      ORDER BY p.criada_em DESC
    `;
    return (rows as unknown as MissionRow[]).map(rowToMission);
  },

  async getPublicCandidateMissions(handle) {
    const rows = await sql`
      ${baseSelect()}
      WHERE lower(u.apelido) = lower(${handle}) AND u.papel IN ('voz', 'spokesperson') AND u.perfil_completo = true
      ORDER BY p.criada_em DESC
    `;
    return (rows as unknown as MissionRow[]).map(rowToMission);
  },

  async getQueuePosition(missionId) {
    const [row] = await sql`
      SELECT (
        SELECT COUNT(*)::int
        FROM pautas antes
        WHERE antes.status = 'disponivel'
          AND antes.criada_em <= p.criada_em
          AND antes.id <> p.id
      ) + 1 AS posicao,
      p.status
      FROM pautas p
      WHERE p.id = ${missionId}
    `;
    if (!row) return 0;
    return row.status === "disponivel" ? row.posicao : 0;
  },

  async getTotalInQueue() {
    const [row] = await sql`SELECT COUNT(*)::int AS total FROM pautas WHERE status = 'disponivel'`;
    return row?.total ?? 0;
  },

  async deleteMission(missionId) {
    await sql`UPDATE pautas SET reservada_por_id = NULL WHERE id = ${missionId}`;
    const rows = await sql`DELETE FROM pautas WHERE id = ${missionId} RETURNING id`;
    if (rows.length === 0) {
      return { ok: false, error: "Missão não encontrada.", erro: "Missão não encontrada." };
    }
    return { ok: true };
  },

  async listAllMissions() {
    const rows = await sql`${baseSelect()} ORDER BY p.criada_em DESC`;
    return (rows as unknown as MissionRow[]).map(rowToMission);
  },
};
