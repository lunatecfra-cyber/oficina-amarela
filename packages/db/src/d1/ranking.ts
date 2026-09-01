import type { RankingRepository } from "../ranking.ts";
import type { D1DatabaseLike } from "./types.ts";

/**
 * Paridade D1 da leitura do ranking.
 *
 * Sem generate_series, sem date_trunc, sem GREATEST: a semana é calculada no
 * domínio e o instante vem de fora. O que sobra é consulta simples, que é
 * exatamente o objetivo de ter tirado a aritmética do SQL.
 */
export function createD1Ranking(db: D1DatabaseLike): RankingRepository {
  return {
    async freezeExpiredCycles() {
      await db
        .prepare(
          "UPDATE ranking_cycles SET frozen_at = ends_at WHERE frozen_at IS NULL AND ends_at < ?",
        )
        .bind(new Date().toISOString())
        .run();
    },

    async currentCycle() {
      const row = await db
        .prepare(
          `SELECT id, name, starts_at, ends_at, frozen_at, max_active_editors
           FROM ranking_cycles ORDER BY starts_at DESC LIMIT 1`,
        )
        .first<{
          id: number;
          name: string;
          starts_at: string;
          ends_at: string;
          frozen_at: string | null;
          max_active_editors: number | null;
          // legacy
          nome?: string;
          inicia_em?: string;
          termina_em?: string;
          congelado_em?: string | null;
        }>();
      if (!row) return null;
      const name = row.name ?? row.nome ?? "";
      const startsAt = row.starts_at ?? row.inicia_em ?? "";
      const endsAt = row.ends_at ?? row.termina_em ?? "";
      const frozenAt = row.frozen_at ?? row.congelado_em ?? null;

      return {
        id: Number(row.id),
        name,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        frozenAt: frozenAt ? new Date(frozenAt).toISOString() : null,
        highestActiveCount: Number(row.max_active_editors ?? 0),
      };
    },

    async entriesForCycle(cycleId) {
      const { results } = await db
        .prepare(
          `SELECT u.id, u.handle, u.name, count(a.mission_id) AS count,
                  max(a.approved_at) AS reached_at
           FROM ranking_approvals a
           JOIN users u ON u.id = a.editor_id
           WHERE a.voided_at IS NULL AND a.cycle_id = ?
           GROUP BY u.id, u.handle, u.name
           ORDER BY count DESC, reached_at ASC, u.id ASC`,
        )
        .bind(cycleId)
        .all<{
          id: number;
          handle?: string;
          name?: string;
          count?: number;
          reached_at?: string | null;
          // legacy
          apelido?: string;
          nome?: string;
          quantidade?: number;
          atingiu_em?: string | null;
        }>();
      return results.map((row) => ({
        id: Number(row.id),
        handle: row.handle ?? row.apelido ?? "",
        name: row.name ?? row.nome ?? "",
        count: Number(row.count ?? row.quantidade ?? 0),
        reachedAt:
          (row.reached_at ?? row.atingiu_em)
            ? new Date(row.reached_at ?? row.atingiu_em ?? "").toISOString()
            : null,
      }));
    },

    async approvalTimes(cycleId, editorId) {
      const statement = editorId
        ? db
            .prepare(
              "SELECT approved_at FROM ranking_approvals WHERE voided_at IS NULL AND cycle_id = ? AND editor_id = ?",
            )
            .bind(cycleId, editorId)
        : db
            .prepare(
              "SELECT approved_at FROM ranking_approvals WHERE voided_at IS NULL AND cycle_id = ?",
            )
            .bind(cycleId);
      const { results } = await statement.all<{ approved_at?: string; aprovado_em?: string }>();
      return results.map((row) => new Date(row.approved_at ?? row.aprovado_em ?? "").toISOString());
    },

    async availableShields(editorId) {
      const row = await db
        .prepare(
          "SELECT count(*) AS total FROM consistency_shields WHERE editor_id = ? AND consumed_at IS NULL",
        )
        .bind(editorId)
        .first<{ total: number }>();
      return Number(row?.total ?? 0);
    },

    async consumedShieldWeeks(editorId) {
      const { results } = await db
        .prepare(
          "SELECT consumed_week FROM consistency_shields WHERE editor_id = ? AND consumed_week IS NOT NULL",
        )
        .bind(editorId)
        .all<{ consumed_week?: string; consumido_semana?: string }>();
      return results.map((row) => String(row.consumed_week ?? row.consumido_semana).slice(0, 10));
    },

    async consumeShield(editorId, weekKey) {
      const consumed = await db
        .prepare(
          `UPDATE consistency_shields SET consumed_at = ?, consumed_week = ?
           WHERE id = (
             SELECT b.id FROM consistency_shields b
             WHERE b.editor_id = ? AND b.consumed_at IS NULL
               AND NOT EXISTS (
                 SELECT 1 FROM consistency_shields usado
                 WHERE usado.editor_id = ? AND usado.consumed_week = ?
               )
             ORDER BY b.granted_at LIMIT 1
           )
           RETURNING id`,
        )
        .bind(new Date().toISOString(), weekKey, editorId, editorId, weekKey)
        .first<{ id: number }>();
      return Boolean(consumed);
    },

    async referralCode(editorId) {
      const row = await db
        .prepare("SELECT referral_code FROM users WHERE id = ?")
        .bind(editorId)
        .first<{ referral_code?: string | null; codigo_indicacao?: string | null }>();
      return row?.referral_code ?? row?.codigo_indicacao ?? null;
    },

    async raiseActiveMilestone(cycleId, activeCount) {
      const row = await db
        .prepare(
          `UPDATE ranking_cycles SET max_active_editors = max(max_active_editors, ?)
           WHERE id = ? RETURNING max_active_editors`,
        )
        .bind(activeCount, cycleId)
        .first<{ max_active_editors: number }>();
      return Number(row?.max_active_editors ?? activeCount);
    },
  };
}
