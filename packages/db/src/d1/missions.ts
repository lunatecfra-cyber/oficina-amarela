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
  SELECT p.id, u.name AS spokesperson_name, u.handle AS spokesperson_handle, p.title, p.format,
         p.brief_tone, p.brief_color, p.brief_font, p.brief_refs,
         p.drive_link, p.youtube_link, p.status, p.reserved_until, p.reserved_at, p.delivery_link,
         p.inspector_notes, p.created_at,
         p.extras, p.motivation, p.desired_deadline, p.revision_requested_by,
         p.drive_link AS raw_video_url, p.raw_video_urls, p.raw_media, p.delivery_video_url,
         p.watermark, p.campaign_tax_id, p.candidate_number, p.voter_id,
         e.handle AS reserved_by_handle
  FROM missions p
  JOIN users u ON u.id = p.spokesperson_id
  LEFT JOIN users e ON e.id = p.reserved_by_id
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

      const campaignIdentity = await db
        .prepare(
          "SELECT watermark, campaign_tax_id, candidate_number FROM users WHERE id = ?",
        )
        .bind(spokespersonId)
        .first<{
          watermark: string | null;
          campaign_tax_id: string | null;
          candidate_number: string | null;
        }>();

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
            data.rawVideoUrls?.[0] ??
            ((data as Record<string, unknown>).rawFootageUrl as string | undefined) ??
            data.videoBrutoUrl ??
            data.videosBrutosUrls?.[0],
          LIMITS.link,
        ),
        rawVideoUrls: (data.rawVideoUrls ?? data.videosBrutosUrls ?? [])
          .map((url) => limitOrNull(url, LIMITS.link))
          .filter((url): url is string => Boolean(url)),
        rawMedia: (data.rawMedia ?? [])
          .filter((item) => item.kind === "video" || item.kind === "image")
          .map((item) => ({
            url: limitOrNull(item.url, LIMITS.link),
            kind: item.kind,
            name: limitOrNull(item.name, LIMITS.briefField) ?? undefined,
            sizeBytes: Number.isInteger(item.sizeBytes) && Number(item.sizeBytes) > 0
              ? Number(item.sizeBytes)
              : undefined,
          }))
          .filter((item): item is typeof item & { url: string } => Boolean(item.url)),
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
          campaignIdentity?.watermark ?? data.watermark ?? data.watermarkUrl ?? data.marcaDagua,
          LIMITS.briefField,
        ),
        campaignTaxId: limitOrNull(
          campaignIdentity?.campaign_tax_id ?? data.campaignTaxId ?? data.cnpjCampanha,
          LIMITS.briefField,
        ),
        candidateNumber: limitOrNull(
          campaignIdentity?.candidate_number ?? data.candidateNumber ?? data.numeroEleitoral,
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
          `INSERT INTO missions (
             spokesperson_id, title, format, drive_link, youtube_link,
             brief_tone, brief_color, brief_font, brief_refs,
             extras, motivation, desired_deadline, raw_video_urls, raw_media,
             watermark, campaign_tax_id, candidate_number, voter_id
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          brief.rawVideoUrls.length ? JSON.stringify(brief.rawVideoUrls) : null,
          brief.rawMedia.length ? JSON.stringify(brief.rawMedia) : null,
          brief.watermark,
          brief.campaignTaxId,
          brief.candidateNumber,
          brief.voterId,
        )
        .first<{ id: number }>();

      if (!row) {
        return {
          ok: false,
          error: "Não foi possível criar a missão. Tente de novo.",
          erro: "Não foi possível criar a missão. Tente de novo.",
        };
      }
      return { ok: true, id: Number(row.id) };
    },

    async getMissionById(id: number): Promise<Mission | null> {
      const row = await db.prepare(`${BASE_QUERY} WHERE p.id = ?`).bind(id).first<MissionRow>();
      return row ? rowToMission(row) : null;
    },

    async getSpokespersonMissions(spokespersonId: number): Promise<Mission[]> {
      const result = await db
        .prepare(`${BASE_QUERY} WHERE p.spokesperson_id = ? ORDER BY p.created_at DESC`)
        .bind(spokespersonId)
        .all<MissionRow>();
      return (result.results ?? []).map(rowToMission);
    },

    async getSpokespersonMissionById(id: number, spokespersonId: number): Promise<Mission | null> {
      const row = await db
        .prepare(`${BASE_QUERY} WHERE p.id = ? AND p.spokesperson_id = ?`)
        .bind(id, spokespersonId)
        .first<MissionRow>();
      return row ? rowToMission(row) : null;
    },

    async getAvailableMissions(): Promise<Mission[]> {
      const result = await db
        .prepare(
          `${BASE_QUERY} WHERE p.status = 'disponivel' ORDER BY p.priority DESC, p.created_at ASC`,
        )
        .all<MissionRow>();
      return (result.results ?? []).map(rowToMission);
    },

    async getMissionsInReview(): Promise<Mission[]> {
      const result = await db
        .prepare(`${BASE_QUERY} WHERE p.status = 'em_revisao' ORDER BY p.created_at ASC`)
        .all<MissionRow>();
      return (result.results ?? []).map(rowToMission);
    },

    async getReservedMission(editorId: number): Promise<Mission | null> {
      const row = await db
        .prepare(
          `${BASE_QUERY}
           WHERE p.reserved_by_id = ?
             AND p.status IN ('reservada', 'em_revisao', 'reedicao', 'aprovada')
           ORDER BY p.reserved_at DESC
           LIMIT 1`,
        )
        .bind(editorId)
        .first<MissionRow>();
      return row ? rowToMission(row) : null;
    },

    async getApprovedDeliveries(editorId: number): Promise<Mission[]> {
      const result = await db
        .prepare(
          `${BASE_QUERY} WHERE p.reserved_by_id = ? AND p.status IN ('aprovada', 'finalizada') ORDER BY p.created_at DESC`,
        )
        .bind(editorId)
        .all<MissionRow>();
      return (result.results ?? []).map(rowToMission);
    },

    async getPublicCandidateMissions(handle: string): Promise<Mission[]> {
      const result = await db
        .prepare(
          `${BASE_QUERY}
           WHERE lower(u.handle) = lower(?) AND u.role IN ('voz', 'spokesperson') AND (u.profile_completed = 1 OR u.profile_completed = true)
           ORDER BY p.created_at DESC`,
        )
        .bind(handle)
        .all<MissionRow>();
      return (result.results ?? []).map(rowToMission);
    },

    async getQueuePosition(missionId: number): Promise<number> {
      const mission = await db
        .prepare("SELECT created_at, status FROM missions WHERE id = ?")
        .bind(missionId)
        .first<{ created_at: string; status: string }>();

      if (mission?.status !== "disponivel") return 0;

      const countRow = await db
        .prepare(
          `SELECT COUNT(*) AS total
           FROM missions
           WHERE status = 'disponivel'
             AND created_at <= ?
             AND id <> ?`,
        )
        .bind(mission.created_at, missionId)
        .first<{ total: number }>();

      return Number(countRow?.total ?? 0) + 1;
    },

    async getTotalInQueue(): Promise<number> {
      const row = await db
        .prepare("SELECT COUNT(*) AS total FROM missions WHERE status = 'disponivel'")
        .first<{ total: number }>();
      return Number(row?.total ?? 0);
    },

    async deleteMission(missionId: number) {
      await db
        .prepare("UPDATE missions SET reserved_by_id = NULL WHERE id = ?")
        .bind(missionId)
        .run();
      const row = await db
        .prepare("DELETE FROM missions WHERE id = ? RETURNING id")
        .bind(missionId)
        .first<{ id: number }>();
      if (!row)
        return { ok: false, error: "Missão não encontrada.", erro: "Missão não encontrada." };
      return { ok: true };
    },

    async listAllMissions(): Promise<Mission[]> {
      const result = await db.prepare(`${BASE_QUERY} ORDER BY p.created_at DESC`).all<MissionRow>();
      return (result.results ?? []).map(rowToMission);
    },
  };
}
