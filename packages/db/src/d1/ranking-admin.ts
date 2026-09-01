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
          `SELECT a.id, a.action, a.entity, a.entity_id, a.details, a.created_at,
                  u.name AS actor_name
           FROM admin_audit a LEFT JOIN users u ON u.id = a.actor_id
           ORDER BY a.created_at DESC LIMIT ?`,
        )
        .bind(limit)
        .all<{
          id: number;
          action: string;
          entity: string;
          entity_id: string | null;
          details: unknown;
          created_at: string;
          actor_name: string | null;
        }>();
      return results.map((r) => {
        let parsedDetails = r.details;
        if (typeof parsedDetails === "string") {
          try {
            parsedDetails = JSON.parse(parsedDetails);
          } catch {}
        }
        return {
          id: r.id,
          action: r.action,
          entity: r.entity,
          entityId: r.entity_id,
          details: parsedDetails,
          createdAt: r.created_at,
          actorName: r.actor_name,
          acao: r.action,
          entidade: r.entity,
          entidade_id: r.entity_id,
          detalhes: parsedDetails,
          criado_em: r.created_at,
          ator_nome: r.actor_name,
        };
      });
    },

    async cancelApproval(missionId, adminId, reason): Promise<RankingAdminResult> {
      const trimmed = reason.trim();
      if (!trimmed) return { ok: false, reason: "reason_required" };
      const now = new Date().toISOString();

      const cancelled = await database
        .prepare(
          `UPDATE ranking_approvals
           SET voided_at = ?, voided_by = ?, void_reason = ?
           WHERE mission_id = ? AND voided_at IS NULL
           RETURNING editor_id`,
        )
        .bind(now, adminId, trimmed, missionId)
        .first<{ editor_id: number }>();
      if (!cancelled) return { ok: false, reason: "approval_not_active" };

      const editorId = Number(cancelled.editor_id);

      await database
        .prepare("UPDATE missions SET is_scored = 0 WHERE id = ?")
        .bind(missionId)
        .run();
      await database.prepare("DELETE FROM reviews WHERE mission_id = ?").bind(missionId).run();
      await database
        .prepare(
          `UPDATE users
           SET delivered_count = max(delivered_count - 1, 0),
               streak = max(streak - 1, 0),
               rating = (SELECT round(avg(rating), 2) FROM reviews
                         WHERE editor_id = ? AND mission_id <> ?)
           WHERE id = ?`,
        )
        .bind(editorId, missionId, editorId)
        .run();
      await database
        .prepare(
          `INSERT INTO admin_audit (actor_id, action, entity, entity_id, details, created_at)
           VALUES (?, 'aprovacao_anulada', 'pauta', ?, ?, ?)`,
        )
        .bind(adminId, String(missionId), JSON.stringify({ motivo: trimmed }), now)
        .run();

      const remaining = await database
        .prepare(
          `SELECT count(*) AS total FROM ranking_approvals
           WHERE editor_id = ? AND voided_at IS NULL`,
        )
        .bind(editorId)
        .first<{ total: number }>();
      if (Number(remaining?.total ?? 0) < 2) {
        const revoked = await database
          .prepare(
            `UPDATE referral_rewards
             SET revoked_at = ?, revoke_reason = ?
             WHERE invitee_id = ? AND revoked_at IS NULL
             RETURNING inviter_id, points`,
          )
          .bind(now, `Aprovação anulada: ${trimmed}`, editorId)
          .first<{ inviter_id: number; points: number }>();
        if (revoked) {
          await database
            .prepare("UPDATE users SET reputation = max(reputation - ?, 0) WHERE id = ?")
            .bind(Number(revoked.points), Number(revoked.inviter_id))
            .run();
        }
      }

      return { ok: true };
    },

    async grantConsistencyShield(editorId, adminId, reason): Promise<RankingAdminResult> {
      const trimmed = reason.trim();
      if (!trimmed) return { ok: false, reason: "reason_required" };
      const now = new Date().toISOString();

      const granted = await database
        .prepare(
          `INSERT INTO consistency_shields (editor_id, granted_by, reason, granted_at)
           SELECT ?, ?, ?, ?
           WHERE (SELECT count(*) FROM consistency_shields
                  WHERE editor_id = ? AND consumed_at IS NULL) < ?
             AND EXISTS (SELECT 1 FROM users WHERE id = ?)
           RETURNING id`,
        )
        .bind(editorId, adminId, trimmed, now, editorId, MAX_CONSISTENCY_SHIELDS, editorId)
        .first<{ id: number }>();
      if (!granted) return { ok: false, reason: "shield_limit_reached" };

      await database
        .prepare(
          `INSERT INTO admin_audit (actor_id, action, entity, entity_id, details, created_at)
           VALUES (?, 'bloqueio_concedido', 'editor', ?, ?, ?)`,
        )
        .bind(adminId, String(editorId), JSON.stringify({ motivo: trimmed }), now)
        .run();

      return { ok: true };
    },
  };
}
