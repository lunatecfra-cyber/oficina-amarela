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
          "UPDATE ranking_ciclos SET congelado_em = termina_em WHERE congelado_em IS NULL AND termina_em < ?",
        )
        .bind(new Date().toISOString())
        .run();
    },

    async currentCycle() {
      const row = await db
        .prepare(
          `SELECT id, nome, inicia_em, termina_em, congelado_em, max_editores_ativos
           FROM ranking_ciclos ORDER BY inicia_em DESC LIMIT 1`,
        )
        .first<{
          id: number;
          nome: string;
          inicia_em: string;
          termina_em: string;
          congelado_em: string | null;
          max_editores_ativos: number | null;
        }>();
      if (!row) return null;
      return {
        id: Number(row.id),
        name: row.nome,
        startsAt: new Date(row.inicia_em).toISOString(),
        endsAt: new Date(row.termina_em).toISOString(),
        frozenAt: row.congelado_em ? new Date(row.congelado_em).toISOString() : null,
        highestActiveCount: Number(row.max_editores_ativos ?? 0),
      };
    },

    async entriesForCycle(cycleId) {
      const { results } = await db
        .prepare(
          `SELECT u.id, u.apelido, u.nome, count(a.pauta_id) AS quantidade,
                  max(a.aprovado_em) AS atingiu_em
           FROM ranking_aprovacoes a
           JOIN users u ON u.id = a.editor_id
           WHERE a.anulado_em IS NULL AND a.ciclo_id = ?
           GROUP BY u.id, u.apelido, u.nome
           ORDER BY quantidade DESC, atingiu_em ASC, u.id ASC`,
        )
        .bind(cycleId)
        .all<{
          id: number;
          apelido: string;
          nome: string;
          quantidade: number;
          atingiu_em: string | null;
        }>();
      return results.map((row) => ({
        id: Number(row.id),
        handle: row.apelido,
        name: row.nome,
        count: Number(row.quantidade),
        reachedAt: row.atingiu_em ? new Date(row.atingiu_em).toISOString() : null,
      }));
    },

    async approvalTimes(cycleId, editorId) {
      const statement = editorId
        ? db
            .prepare(
              "SELECT aprovado_em FROM ranking_aprovacoes WHERE anulado_em IS NULL AND ciclo_id = ? AND editor_id = ?",
            )
            .bind(cycleId, editorId)
        : db
            .prepare(
              "SELECT aprovado_em FROM ranking_aprovacoes WHERE anulado_em IS NULL AND ciclo_id = ?",
            )
            .bind(cycleId);
      const { results } = await statement.all<{ aprovado_em: string }>();
      return results.map((row) => new Date(row.aprovado_em).toISOString());
    },

    async availableShields(editorId) {
      const row = await db
        .prepare(
          "SELECT count(*) AS total FROM bloqueios_constancia WHERE editor_id = ? AND consumido_em IS NULL",
        )
        .bind(editorId)
        .first<{ total: number }>();
      return Number(row?.total ?? 0);
    },

    async consumedShieldWeeks(editorId) {
      const { results } = await db
        .prepare(
          "SELECT consumido_semana FROM bloqueios_constancia WHERE editor_id = ? AND consumido_semana IS NOT NULL",
        )
        .bind(editorId)
        .all<{ consumido_semana: string }>();
      return results.map((row) => String(row.consumido_semana).slice(0, 10));
    },

    async consumeShield(editorId, weekKey) {
      // Mesma invariante do PostgreSQL numa instrução só: a semana já gasta
      // aparece no NOT EXISTS, então não dá para consumir dois na mesma semana.
      const consumed = await db
        .prepare(
          `UPDATE bloqueios_constancia SET consumido_em = ?, consumido_semana = ?
           WHERE id = (
             SELECT b.id FROM bloqueios_constancia b
             WHERE b.editor_id = ? AND b.consumido_em IS NULL
               AND NOT EXISTS (
                 SELECT 1 FROM bloqueios_constancia usado
                 WHERE usado.editor_id = ? AND usado.consumido_semana = ?
               )
             ORDER BY b.concedido_em LIMIT 1
           )
           RETURNING id`,
        )
        .bind(new Date().toISOString(), weekKey, editorId, editorId, weekKey)
        .first<{ id: number }>();
      return Boolean(consumed);
    },

    async referralCode(editorId) {
      const row = await db
        .prepare("SELECT codigo_indicacao FROM users WHERE id = ?")
        .bind(editorId)
        .first<{ codigo_indicacao: string | null }>();
      return row?.codigo_indicacao ?? null;
    },

    async raiseActiveMilestone(cycleId, activeCount) {
      const row = await db
        .prepare(
          `UPDATE ranking_ciclos SET max_editores_ativos = max(max_editores_ativos, ?)
           WHERE id = ? RETURNING max_editores_ativos`,
        )
        .bind(activeCount, cycleId)
        .first<{ max_editores_ativos: number }>();
      return Number(row?.max_editores_ativos ?? activeCount);
    },
  };
}
