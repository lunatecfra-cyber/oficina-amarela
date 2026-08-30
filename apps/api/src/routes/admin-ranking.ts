import type { UserSession } from "@oficina/auth/session";
import type { RankingAdminFailure } from "@oficina/db/ranking-admin";
import { Hono } from "hono";
import type { Bindings } from "../app.ts";
import type { ApiDependencies } from "../dependencies.ts";
import { requireAdmin } from "../session.ts";

/**
 * Correções do inspetor sobre o ranking.
 *
 * auditoria_admin, ranking_aprovacoes, bloqueios_constancia e
 * indicacoes_recompensas estão sob RLS no PostgreSQL, mas a aplicação conecta
 * como dona das tabelas e passa por cima da política — e o D1 nem tem RLS.
 * Quem autoriza é este requireAdmin, e é ele que os testes cobrem.
 */

const AUDIT_LIMIT = 100;

type AdminEnv = {
  Bindings: Bindings;
  Variables: { session: UserSession; requestId: string };
};

function failure(reason: RankingAdminFailure, action: "cancel" | "shield") {
  if (reason === "reason_required") {
    return {
      status: 400 as const,
      error:
        action === "cancel" ? "Informe o motivo da correção." : "Informe o motivo do bloqueio.",
    };
  }
  if (reason === "approval_not_active") {
    return { status: 409 as const, error: "Esta aprovação não está ativa no ranking." };
  }
  return { status: 409 as const, error: "Editor já possui o máximo de dois bloqueios." };
}

export function createAdminRankingRoutes(dependencies: ApiDependencies) {
  const routes = new Hono<AdminEnv>();
  routes.use("*", requireAdmin);

  routes.get("/", async (c) => {
    const audit = await dependencies.rankingAdmin.recentAudit(AUDIT_LIMIT);
    return c.json({ audit, auditoria: audit });
  });

  routes.post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    const session = c.get("session");
    const action = body?.action ?? body?.acao;
    const reason = String(body?.reason ?? body?.motivo ?? "");

    if (action === "cancel_approval" || action === "anular_aprovacao") {
      const missionId = Number(body?.missionId ?? body?.pautaId);
      if (!Number.isInteger(missionId) || missionId < 1) {
        return c.json({ error: "Missão inválida." }, 400);
      }
      const result = await dependencies.rankingAdmin.cancelApproval(missionId, session.id, reason);
      if (!result.ok) {
        const response = failure(result.reason, "cancel");
        return c.json({ error: response.error }, response.status);
      }
      return c.json({ ok: true });
    }

    if (action === "grant_shield" || action === "conceder_bloqueio") {
      const editorId = Number(body?.editorId);
      if (!Number.isInteger(editorId) || editorId < 1) {
        return c.json({ error: "Editor inválido." }, 400);
      }
      const result = await dependencies.rankingAdmin.grantConsistencyShield(
        editorId,
        session.id,
        reason,
      );
      if (!result.ok) {
        const response = failure(result.reason, "shield");
        return c.json({ error: response.error }, response.status);
      }
      return c.json({ ok: true });
    }

    return c.json({ error: "Ação inválida." }, 400);
  });

  return routes;
}
