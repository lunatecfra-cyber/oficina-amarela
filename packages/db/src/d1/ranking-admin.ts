import type { RankingAdminRepository, RankingAdminResult } from "../ranking-admin.ts";
import { MAX_CONSISTENCY_SHIELDS } from "../ranking-admin.ts";
import type { D1DatabaseLike } from "./types.ts";

/**
 * Paridade D1 das correções do inspetor sobre o ranking.
 *
 * O PostgreSQL faz a anulação numa CTE que modifica dado; o SQLite não tem
 * isso. Aqui o papel de invariante passa para a própria linha de
 * ranking_aprovacoes: o UPDATE condicional (`anulado_em IS NULL`) só encontra
 * linha uma vez, e é o RETURNING dele que autoriza os efeitos seguintes. Duas
 * anulações concorrentes da mesma pauta descontam uma vez só, porque a segunda
 * não encontra o que anular.
 *
 * A concessão de bloqueio usa a mesma ideia: em vez de contar e depois
 * inserir — que abriria a corrida que a trava resolve no PostgreSQL — o
 * INSERT ... SELECT só produz linha enquanto o saldo couber, e a decisão
 * acontece dentro de uma instrução só.
 */

type D1BatchCapable = D1DatabaseLike & {
  batch?(statements: unknown[]): Promise<unknown>;
};

export function createD1RankingAdmin(db: D1DatabaseLike): RankingAdminRepository {
  const database = db as D1BatchCapable;

  return {
    async recentAudit(limit) {
      const { results } = await database
        .prepare(
          `SELECT a.id, a.acao, a.entidade, a.entidade_id, a.detalhes, a.criado_em,
                  u.nome AS ator_nome
           FROM auditoria_admin a LEFT JOIN users u ON u.id = a.ator_id
           ORDER BY a.criado_em DESC LIMIT ?`,
        )
        .bind(limit)
        .all();
      return results as never;
    },

    async cancelApproval(missionId, adminId, reason): Promise<RankingAdminResult> {
      const trimmed = reason.trim();
      if (!trimmed) return { ok: false, reason: "reason_required" };
      const now = new Date().toISOString();

      // Só quem consegue anular segue adiante. Este UPDATE é o portão.
      const cancelled = await database
        .prepare(
          `UPDATE ranking_aprovacoes
           SET anulado_em = ?, anulado_por = ?, motivo_anulacao = ?
           WHERE pauta_id = ? AND anulado_em IS NULL
           RETURNING editor_id`,
        )
        .bind(now, adminId, trimmed, missionId)
        .first<{ editor_id: number }>();
      if (!cancelled) return { ok: false, reason: "approval_not_active" };

      const editorId = Number(cancelled.editor_id);

      await database.prepare("UPDATE pautas SET pontuada = 0 WHERE id = ?").bind(missionId).run();
      await database.prepare("DELETE FROM avaliacoes WHERE pauta_id = ?").bind(missionId).run();
      await database
        .prepare(
          // Sem desconto de reputação: ver a nota em ranking-admin.ts.
          `UPDATE users
           SET entregues = max(entregues - 1, 0),
               streak = max(streak - 1, 0),
               nota = (SELECT round(avg(nota), 2) FROM avaliacoes
                       WHERE editor_id = ? AND pauta_id <> ?)
           WHERE id = ?`,
        )
        .bind(editorId, missionId, editorId)
        .run();
      await database
        .prepare(
          `INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes, criado_em)
           VALUES (?, 'aprovacao_anulada', 'pauta', ?, ?, ?)`,
        )
        .bind(adminId, String(missionId), JSON.stringify({ motivo: trimmed }), now)
        .run();

      // Indicação premiada deixa de valer abaixo de duas aprovações válidas.
      const remaining = await database
        .prepare(
          `SELECT count(*) AS total FROM ranking_aprovacoes
           WHERE editor_id = ? AND anulado_em IS NULL`,
        )
        .bind(editorId)
        .first<{ total: number }>();
      if (Number(remaining?.total ?? 0) < 2) {
        const revoked = await database
          .prepare(
            `UPDATE indicacoes_recompensas
             SET revogado_em = ?, motivo_revogacao = ?
             WHERE convidado_id = ? AND revogado_em IS NULL
             RETURNING convidador_id, pontos`,
          )
          .bind(now, `Aprovação anulada: ${trimmed}`, editorId)
          .first<{ convidador_id: number; pontos: number }>();
        if (revoked) {
          await database
            .prepare("UPDATE users SET reputacao = max(reputacao - ?, 0) WHERE id = ?")
            .bind(Number(revoked.pontos), Number(revoked.convidador_id))
            .run();
        }
      }

      return { ok: true };
    },

    async grantConsistencyShield(editorId, adminId, reason): Promise<RankingAdminResult> {
      const trimmed = reason.trim();
      if (!trimmed) return { ok: false, reason: "reason_required" };
      const now = new Date().toISOString();

      // Contar e inserir numa instrução só: não existe janela entre a leitura
      // do saldo e a gravação, então não há corrida a proteger com trava.
      const granted = await database
        .prepare(
          `INSERT INTO bloqueios_constancia (editor_id, concedido_por, motivo, concedido_em)
           SELECT ?, ?, ?, ?
           WHERE (SELECT count(*) FROM bloqueios_constancia
                  WHERE editor_id = ? AND consumido_em IS NULL) < ?
             AND EXISTS (SELECT 1 FROM users WHERE id = ?)
           RETURNING id`,
        )
        .bind(editorId, adminId, trimmed, now, editorId, MAX_CONSISTENCY_SHIELDS, editorId)
        .first<{ id: number }>();
      if (!granted) return { ok: false, reason: "shield_limit_reached" };

      await database
        .prepare(
          `INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes, criado_em)
           VALUES (?, 'bloqueio_concedido', 'editor', ?, ?, ?)`,
        )
        .bind(adminId, String(editorId), JSON.stringify({ motivo: trimmed }), now)
        .run();

      return { ok: true };
    },
  };
}
