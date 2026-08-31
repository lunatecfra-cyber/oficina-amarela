import { LIMITS, limitOrNull, limitStr } from "@oficina/domain/limits";
import type { Mission } from "@oficina/domain/missions";
import {
  type CreateMissionInput,
  type MissionRow,
  type MissionsRepository,
  rowToMission,
} from "../missions.ts";
import type { D1DatabaseLike } from "./types.ts";

const BASE_QUERY = `
  SELECT p.id, u.nome AS porta_voz_nome, u.apelido AS porta_voz_apelido, p.titulo, p.formato,
         p.brief_tom, p.brief_cor, p.brief_fonte, p.brief_refs,
         p.drive_link, p.youtube_link, p.status, p.reservada_ate, p.reservada_em, p.entrega_link,
         p.notas_inspetor, p.criada_em,
         p.extras, p.motivo, p.prazo_desejado, p.reedicao_pedida_por,
         p.drive_link AS video_bruto_url, p.video_entrega_url,
         p.marca_dagua, p.cnpj_campanha, p.candidate_number, p.titulo_eleitor,
         e.apelido AS reservada_por_apelido
  FROM pautas p
  JOIN users u ON u.id = p.porta_voz_id
  LEFT JOIN users e ON e.id = p.reservada_por_id
`;

export function createD1Missions(db: D1DatabaseLike): MissionsRepository {
  return {
    async createMission(data: CreateMissionInput) {
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
        driveLink: limitOrNull(
          data.driveLink ??
            data.rawVideoUrl ??
            ((data as Record<string, unknown>).rawFootageUrl as string | undefined) ??
            data.videoBrutoUrl,
          LIMITS.link,
        ),
        youtubeLink: limitOrNull(
          data.youtubeLink ??
            ((data as Record<string, unknown>).publishedYoutubeUrl as string | undefined),
          LIMITS.link,
        ),
        deadline: limitOrNull(
          data.deadline ?? data.prazo ?? data.desiredDeadline ?? data.prazoDesejado,
          10,
        ),
        watermark: limitOrNull(
          data.watermark ?? data.watermarkUrl ?? data.marcaDagua,
          LIMITS.briefField,
        ),
        campaignTaxId: limitOrNull(data.campaignTaxId ?? data.cnpjCampanha, LIMITS.briefField),
        candidateNumber: limitOrNull(
          data.candidateNumber ?? data.numeroEleitoral,
          LIMITS.briefField,
        ),
        voterId: limitOrNull(
          data.voterId ?? data.voterRegistrationId ?? data.tituloEleitor,
          LIMITS.briefField,
        ),
      };

      const dbFormato = rawFormat === "long" ? "longo" : rawFormat;

      const row = await db
        .prepare(
          `INSERT INTO pautas (
             porta_voz_id, titulo, formato, drive_link, youtube_link,
             brief_tom, brief_cor, brief_fonte, brief_refs,
             extras, motivo, prazo_desejado,
             marca_dagua, cnpj_campanha, candidate_number, titulo_eleitor
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           RETURNING id`,
        )
        .bind(
          spokespersonId,
          title,
          dbFormato,
          brief.driveLink,
          brief.youtubeLink,
          brief.tone,
          brief.color,
          brief.font,
          brief.refs,
          brief.extras,
          brief.motivation,
          brief.deadline,
          brief.watermark,
          brief.campaignTaxId,
          brief.candidateNumber,
          brief.voterId,
        )
        .first<{ id: number }>();

      return { ok: true, id: Number(row?.id) };
    },

    async getMissionById(id: number): Promise<Mission | null> {
      const row = await db.prepare(`${BASE_QUERY} WHERE p.id = ?`).bind(id).first<MissionRow>();
      return row ? rowToMission(row) : null;
    },

    async getSpokespersonMissions(spokespersonId: number): Promise<Mission[]> {
      const result = await db
        .prepare(`${BASE_QUERY} WHERE p.porta_voz_id = ? ORDER BY p.criada_em DESC`)
        .bind(spokespersonId)
        .all<MissionRow>();
      return (result.results ?? []).map(rowToMission);
    },

    async getSpokespersonMissionById(id: number, spokespersonId: number): Promise<Mission | null> {
      const row = await db
        .prepare(`${BASE_QUERY} WHERE p.id = ? AND p.porta_voz_id = ?`)
        .bind(id, spokespersonId)
        .first<MissionRow>();
      return row ? rowToMission(row) : null;
    },

    async getAvailableMissions(): Promise<Mission[]> {
      const result = await db
        .prepare(
          `${BASE_QUERY} WHERE p.status = 'disponivel' ORDER BY p.prioridade DESC, p.criada_em ASC`,
        )
        .all<MissionRow>();
      return (result.results ?? []).map(rowToMission);
    },

    async getMissionsInReview(): Promise<Mission[]> {
      const result = await db
        .prepare(`${BASE_QUERY} WHERE p.status = 'em_revisao' ORDER BY p.criada_em ASC`)
        .all<MissionRow>();
      return (result.results ?? []).map(rowToMission);
    },

    async getReservedMission(editorId: number): Promise<Mission | null> {
      const row = await db
        .prepare(
          `${BASE_QUERY}
           WHERE p.reservada_por_id = ?
             AND p.status IN ('reservada', 'em_revisao', 'reedicao', 'aprovada')
           ORDER BY p.reservada_em DESC
           LIMIT 1`,
        )
        .bind(editorId)
        .first<MissionRow>();
      return row ? rowToMission(row) : null;
    },

    async getApprovedDeliveries(editorId: number): Promise<Mission[]> {
      const result = await db
        .prepare(
          `${BASE_QUERY} WHERE p.reservada_por_id = ? AND p.status IN ('aprovada', 'finalizada') ORDER BY p.criada_em DESC`,
        )
        .bind(editorId)
        .all<MissionRow>();
      return (result.results ?? []).map(rowToMission);
    },

    async getPublicCandidateMissions(handle: string): Promise<Mission[]> {
      const result = await db
        .prepare(
          `${BASE_QUERY}
           WHERE lower(u.apelido) = lower(?) AND u.papel IN ('voz', 'spokesperson') AND (u.perfil_completo = 1 OR u.perfil_completo = true)
           ORDER BY p.criada_em DESC`,
        )
        .bind(handle)
        .all<MissionRow>();
      return (result.results ?? []).map(rowToMission);
    },

    async getQueuePosition(missionId: number): Promise<number> {
      const mission = await db
        .prepare("SELECT criada_em, status FROM pautas WHERE id = ?")
        .bind(missionId)
        .first<{ criada_em: string; status: string }>();

      if (mission?.status !== "disponivel") return 0;

      const countRow = await db
        .prepare(
          `SELECT COUNT(*) AS total
           FROM pautas
           WHERE status = 'disponivel'
             AND criada_em <= ?
             AND id <> ?`,
        )
        .bind(mission.criada_em, missionId)
        .first<{ total: number }>();

      return Number(countRow?.total ?? 0) + 1;
    },

    async getTotalInQueue(): Promise<number> {
      const row = await db
        .prepare("SELECT COUNT(*) AS total FROM pautas WHERE status = 'disponivel'")
        .first<{ total: number }>();
      return Number(row?.total ?? 0);
    },

    async deleteMission(missionId: number) {
      await db
        .prepare("UPDATE pautas SET reservada_por_id = NULL WHERE id = ?")
        .bind(missionId)
        .run();
      const row = await db
        .prepare("DELETE FROM pautas WHERE id = ? RETURNING id")
        .bind(missionId)
        .first<{ id: number }>();
      if (!row)
        return { ok: false, error: "Missão não encontrada.", erro: "Missão não encontrada." };
      return { ok: true };
    },

    async listAllMissions(): Promise<Mission[]> {
      const result = await db.prepare(`${BASE_QUERY} ORDER BY p.criada_em DESC`).all<MissionRow>();
      return (result.results ?? []).map(rowToMission);
    },
  };
}
