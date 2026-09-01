import { type TransactionSql, withTransaction } from "./client.ts";

/**
 * Correções do inspetor sobre o ranking eleitoral.
 *
 * São as duas operações que mexem em dado sob RLS sem passar pelo fluxo normal
 * de missão: anular uma aprovação já pontuada e conceder bloqueio de constância.
 * Ambas escrevem auditoria, e a autorização é explícita na fronteira da API.
 */

export const MAX_CONSISTENCY_SHIELDS = 2;

export type RankingAdminFailure =
  | "reason_required"
  | "approval_not_active"
  | "shield_limit_reached";

export type RankingAdminResult = { ok: true } | { ok: false; reason: RankingAdminFailure };

export type AuditEvent = {
  id: number;
  action?: string;
  entity?: string;
  entityId?: string | null;
  details?: unknown;
  createdAt?: string;
  actorName?: string | null;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  detalhes: unknown;
  criado_em: string;
  ator_nome: string | null;
};

export interface RankingAdminRepository {
  recentAudit(limit: number): Promise<AuditEvent[]>;
  cancelApproval(missionId: number, adminId: number, reason: string): Promise<RankingAdminResult>;
  grantConsistencyShield(
    editorId: number,
    adminId: number,
    reason: string,
  ): Promise<RankingAdminResult>;
}

/**
 * Indicação premiada deixa de valer quando o editor cai abaixo de duas
 * aprovações válidas: os pontos voltam de quem indicou.
 */
async function recalculateReferral(
  transaction: TransactionSql,
  editorId: number,
  reason: string,
): Promise<void> {
  const [count] = await transaction`
    SELECT count(*)::int AS total FROM ranking_aprovacoes
    WHERE editor_id = ${editorId} AND anulado_em IS NULL
  `;
  if (Number(count?.total ?? 0) >= 2) return;
  await transaction`
    WITH revogada AS (
      UPDATE indicacoes_recompensas
      SET revogado_em = now(), motivo_revogacao = ${`Aprovação anulada: ${reason}`}
      WHERE convidado_id = ${editorId} AND revogado_em IS NULL
      RETURNING convidador_id, pontos
    )
    UPDATE users u
    SET reputacao = GREATEST(u.reputacao - revogada.pontos, 0)
    FROM revogada WHERE u.id = revogada.convidador_id
  `;
}

export const postgresRankingAdmin: RankingAdminRepository = {
  async recentAudit(limit) {
    return (await withTransaction(
      (transaction) => transaction`
        SELECT a.id, a.acao, a.entidade, a.entidade_id, a.detalhes, a.criado_em,
               u.nome AS ator_nome
        FROM auditoria_admin a LEFT JOIN users u ON u.id = a.ator_id
        ORDER BY a.criado_em DESC LIMIT ${limit}
      `,
    )) as unknown as AuditEvent[];
  },

  async cancelApproval(missionId, adminId, reason) {
    const trimmed = reason.trim();
    if (!trimmed) return { ok: false, reason: "reason_required" };

    return withTransaction(async (transaction) => {
      // Anulação, desconto de métrica, reputação e auditoria em uma instrução
      // só: anular duas vezes a mesma pauta não desconta duas vezes, porque a
      // CTE `anulada` só encontra linha enquanto anulado_em está nulo.
      const [record] = await transaction`
        WITH anulada AS (
          UPDATE ranking_aprovacoes
          SET anulado_em = now(), anulado_por = ${adminId}, motivo_anulacao = ${trimmed}
          WHERE pauta_id = ${missionId} AND anulado_em IS NULL
          RETURNING editor_id
        ), pauta_corrigida AS (
          UPDATE pautas SET pontuada = false
          WHERE id = ${missionId} AND EXISTS (SELECT 1 FROM anulada)
          RETURNING id
        ), avaliacao_removida AS (
          DELETE FROM avaliacoes
          WHERE pauta_id = ${missionId} AND EXISTS (SELECT 1 FROM anulada)
          RETURNING editor_id
        ), usuario_corrigido AS (
          -- A reputação NÃO é mexida aqui. Havia um desconto fixo de 25, e 25 não é o
          -- que a entrega paga: o XP vem de gamificacao_eventos, hoje 100 por
          -- vídeo. Anular uma aprovação descontava um número que ninguém tinha
          -- creditado, e repetir a anulação drenava reputação de trabalho que
          -- continuava valendo. Reverter o evento certo é outro assunto;
          -- descontar um valor inventado é pior que não descontar.
          UPDATE users u
          SET entregues = GREATEST(u.entregues - 1, 0),
              streak = GREATEST(u.streak - 1, 0),
              nota = (SELECT round(avg(a.nota)::numeric, 2)
                      FROM avaliacoes a WHERE a.editor_id = u.id AND a.pauta_id <> ${missionId})
          FROM anulada WHERE u.id = anulada.editor_id
          RETURNING u.id
        ), auditada AS (
          INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes)
          SELECT ${adminId}, 'aprovacao_anulada', 'pauta', ${String(missionId)},
                 ${transaction.json({ motivo: trimmed })}
          FROM anulada RETURNING id
        )
        SELECT editor_id FROM anulada
      `;
      if (!record) return { ok: false as const, reason: "approval_not_active" as const };
      await recalculateReferral(transaction, Number(record.editor_id), trimmed);
      return { ok: true as const };
    });
  },

  async grantConsistencyShield(editorId, adminId, reason) {
    const trimmed = reason.trim();
    if (!trimmed) return { ok: false, reason: "reason_required" };

    return withTransaction(async (transaction) => {
      // Trava a linha do editor antes de contar: sem isso, duas concessões
      // simultâneas leem o mesmo saldo e o editor passa do máximo de dois.
      // Não há índice único que segure esse limite — a trava é a invariante.
      const [editor] = await transaction`
        SELECT id FROM users WHERE id = ${editorId} FOR UPDATE
      `;
      if (!editor) return { ok: false as const, reason: "shield_limit_reached" as const };

      const [balance] = await transaction`
        SELECT count(*)::int AS total FROM bloqueios_constancia
        WHERE editor_id = ${editorId} AND consumido_em IS NULL
      `;
      if (Number(balance?.total ?? 0) >= MAX_CONSISTENCY_SHIELDS) {
        return { ok: false as const, reason: "shield_limit_reached" as const };
      }

      await transaction`
        INSERT INTO bloqueios_constancia (editor_id, concedido_por, motivo)
        VALUES (${editorId}, ${adminId}, ${trimmed})
      `;
      await transaction`
        INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes)
        VALUES (${adminId}, 'bloqueio_concedido', 'editor', ${String(editorId)},
                ${transaction.json({ motivo: trimmed })})
      `;
      return { ok: true as const };
    });
  },
};
