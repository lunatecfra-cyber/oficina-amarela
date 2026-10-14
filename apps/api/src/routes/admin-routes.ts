import type { UserSession } from "@oficina/auth/session";
import type { D1DatabaseLike } from "@oficina/db/d1/types";
import { buildAdminNotifications } from "@oficina/domain/notifications";
import { drainEmailQueueNow, queueNoticeEmail } from "@oficina/email/dispatch";
import { buildEditorsQueueEmail, buildFreeEditorsEmail } from "@oficina/email/messages";
import { Hono } from "hono";
import type { Bindings } from "../app.ts";
import type { ApiDependencies } from "../dependencies.ts";
import { requireCapability, requireSession } from "../session.ts";

export type BroadcastAudience = "editors" | "spokespersons";

/**
 * O painel de panorama manda `{ type }`, não assunto e mensagem.
 *
 * O contrato tinha derivado: a rota exigia `subject`/`message` e devolvia 400
 * em todo clique dos botões "avisar editores" e "avisar porta-vozes". Resolver
 * o público num ponto só é o que deixa a divergência aparecer num teste em vez
 * de aparecer no botão.
 */
export function resolveBroadcastAudience(
  body: Record<string, unknown> | null,
): BroadcastAudience | null {
  const raw = String(body?.type ?? body?.tipo ?? "");
  if (raw === "editors" || raw === "editores") return "editors";
  if (raw === "candidates" || raw === "candidatos" || raw === "spokespersons") {
    return "spokespersons";
  }
  return null;
}

type AdminEnv = {
  Bindings: Bindings;
  Variables: { session: UserSession; requestId: string };
};

export function createAdminManagementRoutes(dependencies: ApiDependencies) {
  const routes = new Hono<AdminEnv>();
  routes.use("*", requireSession);

  routes.get("/users", requireCapability("users.manage"), async (c) => {
    const q = c.req.query("q") ?? "";
    const users = await dependencies.admin.searchUsers(q);
    return c.json({ users, usuarios: users, items: users });
  });

  routes.post("/users", requireCapability("users.manage"), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const userId = Number(body?.userId ?? body?.id);
    const action = String(body?.action ?? body?.acao ?? "");
    const reason = String(body?.reason ?? body?.motivo ?? "");

    if (!Number.isInteger(userId)) {
      return c.json({ error: "Usuário inválido.", erro: "Usuário inválido." }, 400);
    }

    if (action === "ban" || action === "banir") {
      const result = await dependencies.admin.banUser(userId, reason);
      if (!result.ok) return c.json({ error: result.error, erro: result.error }, 400);
      return c.json({ ok: true });
    }

    if (action === "unban" || action === "desbanir") {
      const result = await dependencies.admin.unbanUser(userId);
      if (!result.ok) return c.json({ error: result.error, erro: result.error }, 400);
      return c.json({ ok: true });
    }

    if (action === "delete" || action === "apagar") {
      const result = await dependencies.admin.removeUser(userId);
      if (!result.ok) return c.json({ error: result.error, erro: result.error }, 400);
      return c.json(result);
    }

    return c.json({ error: "Ação inválida.", erro: "Ação inválida." }, 400);
  });

  routes.get("/users/:id", requireCapability("users.manage"), async (c) => {
    const id = Number(c.req.param("id"));
    const user = await dependencies.admin.viewUserDetails(id);
    if (!user)
      return c.json({ error: "Conta não encontrada.", erro: "Conta não encontrada." }, 404);
    const verification = c.env.DB
      ? await (c.env.DB as D1DatabaseLike)
          .prepare("SELECT verified FROM editor_verifications WHERE editor_id=?")
          .bind(id)
          .first<{ verified: number }>()
      : null;
    const detail = { ...user, editorVerified: Boolean(verification?.verified) };
    return c.json({ ...detail, user: detail, usuario: detail });
  });

  routes.post("/users/:id", requireCapability("users.manage"), async (c) => {
    const body = await c.req.json().catch(() => null),
      id = Number(c.req.param("id"));
    if (!c.env.DB) return c.json({ error: "Habilitação indisponível neste ambiente." }, 503);
    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      typeof body?.verified !== "boolean" ||
      typeof body?.reason !== "string" ||
      !body.reason.trim() ||
      body.reason.trim().length > 500
    )
      return c.json({ error: "Informe a habilitação e o motivo (até 500 caracteres)." }, 400);
    const db = c.env.DB as D1DatabaseLike,
      actor = c.get("session");
    const result = await db
      .prepare(`INSERT INTO editor_verifications(editor_id,verified,admin_id,reason)
      SELECT id,?,?,? FROM users WHERE id=? AND role='editor' AND is_banned=0 AND profile_completed=1
      AND EXISTS(SELECT 1 FROM users WHERE id=? AND role='admin' AND is_banned=0)
      ON CONFLICT(editor_id) DO UPDATE SET verified=excluded.verified,admin_id=excluded.admin_id,reason=excluded.reason,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
      .bind(Number(body.verified), actor.id, body.reason.trim(), id, actor.id)
      .run();
    return result.meta.changes
      ? c.json({ ok: true })
      : c.json({ error: "Editor não está disponível para habilitação." }, 409);
  });

  routes.post("/users/:id/role", requireCapability("users.manage"), async (c) => {
    if (!c.env.DB) return c.json({ error: "Alteração de papel indisponível neste ambiente." }, 503);
    const id = Number(c.req.param("id")),
      body = await c.req.json().catch(() => null);
    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      !["editor", "spokesperson", "inspector", "admin"].includes(body?.role) ||
      typeof body?.reason !== "string" ||
      body.reason.trim().length < 5 ||
      body.reason.trim().length > 1000
    )
      return c.json({ error: "Informe papel e justificativa (5 a 1000 caracteres)." }, 400);
    const db = c.env.DB as D1DatabaseLike;
    const user = await db.prepare("SELECT id FROM users WHERE id=?").bind(id).first();
    if (!user) return c.json({ error: "Conta não encontrada." }, 404);
    await db.batch!([
      db
        .prepare("UPDATE users SET role=? WHERE id=?")
        .bind(body.role === "spokesperson" ? "voz" : body.role, id),
      db
        .prepare(
          "INSERT INTO admin_audit(actor_id,action,entity,entity_id,details) VALUES(?,'papel_alterado','user',?,?)",
        )
        .bind(
          c.get("session").id,
          String(id),
          JSON.stringify({ role: body.role, reason: body.reason.trim() }),
        ),
    ]);
    return c.json({ ok: true });
  });

  routes.post("/users/:id/ban", requireCapability("users.manage"), async (c) => {
    const id = Number(c.req.param("id"));
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const reason = String(body?.reason ?? body?.motivo ?? "");
    const result = await dependencies.admin.banUser(id, reason);
    if (!result.ok) return c.json({ error: result.error, erro: result.error }, 400);
    return c.json({ ok: true });
  });

  routes.post("/users/:id/unban", requireCapability("users.manage"), async (c) => {
    const id = Number(c.req.param("id"));
    const result = await dependencies.admin.unbanUser(id);
    if (!result.ok) return c.json({ error: result.error, erro: result.error }, 400);
    return c.json({ ok: true });
  });

  routes.delete("/users/:id", requireCapability("users.manage"), async (c) => {
    const id = Number(c.req.param("id"));
    const result = await dependencies.admin.removeUser(id);
    if (!result.ok) return c.json({ error: result.error, erro: result.error }, 400);
    return c.json(result);
  });

  routes.get("/reports", requireCapability("reports.read"), async (c) => {
    const reports = await dependencies.admin.reportsForInspector();
    const capability = c.env.DB
      ? await (c.env.DB as D1DatabaseLike)
          .prepare(`SELECT 1 FROM admin_capabilities a JOIN users u ON u.id=a.user_id
      WHERE u.id=? AND u.role='admin' AND u.is_banned=0 AND a.capability='release_report_retention'`)
          .bind(c.get("session").id)
          .first()
      : null;
    const items = reports.map((report) => ({
      ...report,
      canDecide: c.get("session").capabilities?.includes("reports.decide") ?? false,
      canForward: c.get("session").capabilities?.includes("reports.forward") ?? false,
      canReleaseRetention: Boolean(
        capability &&
          c.get("session").capabilities?.includes("reports.releaseRetention") &&
          report.evidenceCapturedAt,
      ),
    }));
    c.header("cache-control", "private, no-store");
    return c.json({ reports: items, denuncias: items, items });
  });

  routes.post("/reports/:id/resolve", requireCapability("reports.decide"), async (c) => {
    const id = Number(c.req.param("id"));
    if (!c.env.DB)
      return c.json({ error: "Moderação auditável indisponível neste ambiente." }, 503);
    const body = await c.req.json().catch(() => null);
    const status = body?.status;
    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      !["resolved", "ignored", "resolvida", "ignorada"].includes(status) ||
      typeof body?.reason !== "string" ||
      body.reason.trim().length < 5 ||
      body.reason.trim().length > 1000
    )
      return c.json({ error: "Informe a decisão e a justificativa (5 a 1000 caracteres)." }, 400);
    const result = await dependencies.admin.resolveReport(
      id,
      status,
      c.get("session").id,
      body.reason,
    );
    if (!result.ok) return c.json({ error: result.error, erro: result.error }, 409);
    return c.json({ ok: true });
  });

  routes.get("/reports/:id/evidence", requireCapability("reports.read"), async (c) => {
    if (!c.env.DB) return c.json({ error: "Evidência indisponível neste ambiente." }, 503);
    const db = c.env.DB as D1DatabaseLike,
      id = Number(c.req.param("id"));
    const capture = await db
      .prepare(
        "SELECT origin,captured_at AS capturedAt FROM report_evidence_captures WHERE report_id=?",
      )
      .bind(id)
      .first();
    if (!capture) return c.json({ error: "Evidência não encontrada." }, 404);
    const { results: evidence } = await db
      .prepare(
        "SELECT kind,source_id AS sourceId,payload FROM report_evidence WHERE report_id=? ORDER BY kind,source_id",
      )
      .bind(id)
      .all();
    c.header("cache-control", "private, no-store");
    c.header("content-disposition", `attachment; filename="denuncia-${id}.json"`);
    return c.json({ capture, evidence });
  });

  routes.post(
    "/reports/:id/release-retention",
    requireCapability("reports.releaseRetention"),
    async (c) => {
      if (!c.env.DB) return c.json({ error: "Retenção indisponível neste ambiente." }, 503);
      const db = c.env.DB as D1DatabaseLike,
        id = Number(c.req.param("id")),
        body = await c.req.json().catch(() => null),
        actorId = c.get("session").id;
      if (
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        typeof body?.reason !== "string" ||
        body.reason.trim().length < 5 ||
        body.reason.trim().length > 1000
      )
        return c.json(
          { error: "Informe a justificativa de liberação (5 a 1000 caracteres)." },
          400,
        );
      const capability = await db
        .prepare(`SELECT 1 FROM admin_capabilities a JOIN users u ON u.id=a.user_id
      WHERE u.id=? AND u.role='admin' AND u.is_banned=0 AND a.capability='release_report_retention'`)
        .bind(actorId)
        .first();
      if (!capability)
        return c.json({ error: "Sua conta não pode liberar retenção de evidências." }, 403);
      try {
        await db
          .prepare(`INSERT INTO report_retention_releases(report_id,actor_id,actor_name,reason)
        SELECT ?,id,name,? FROM users WHERE id=? ON CONFLICT(report_id) DO NOTHING`)
          .bind(id, body.reason.trim(), actorId)
          .run();
      } catch (error) {
        if (!/report_release_unavailable/.test(String(error))) throw error;
        return c.json(
          {
            error: "Encerre a denúncia e verifique o impedimento do responsável antes de liberar.",
          },
          409,
        );
      }
      const release = await db
        .prepare("SELECT actor_id,reason FROM report_retention_releases WHERE report_id=?")
        .bind(id)
        .first<{ actor_id: number; reason: string }>();
      return release?.actor_id === actorId && release.reason === body.reason.trim()
        ? c.json({ ok: true })
        : c.json({ error: "Retenção já liberada por outra decisão." }, 409);
    },
  );

  routes.post("/reports/:id/forward", requireCapability("reports.forward"), async (c) => {
    if (!c.env.DB) return c.json({ error: "Encaminhamento indisponível neste ambiente." }, 503);
    const id = Number(c.req.param("id")),
      body = await c.req.json().catch(() => null),
      actor = c.get("session");
    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      typeof body?.reason !== "string" ||
      body.reason.trim().length < 5 ||
      body.reason.trim().length > 1000
    )
      return c.json({ error: "Informe a justificativa (5 a 1000 caracteres)." }, 400);
    try {
      await (c.env.DB as D1DatabaseLike)
        .prepare(
          "INSERT INTO report_forwardings(report_id,actor_id,actor_name,reason) VALUES(?,?,?,?) ON CONFLICT(report_id,actor_id,reason) DO NOTHING",
        )
        .bind(id, actor.id, actor.name, body.reason.trim())
        .run();
    } catch (error) {
      if (!/report_forward_unavailable|FOREIGN KEY/.test(String(error))) throw error;
      return c.json({ error: "Denúncia indisponível para encaminhamento." }, 409);
    }
    return c.json({ ok: true });
  });

  routes.get("/overview", requireCapability("security.read"), async (c) => {
    const overview = await dependencies.admin.getSystemOverview();
    return c.json(overview);
  });

  routes.get("/queue", requireCapability("mission.read"), async (c) => {
    const queue = await dependencies.admin.getEditingQueue();
    return c.json({ queue, fila: queue, items: queue });
  });

  routes.get("/in-flight", requireCapability("mission.read"), async (c) => {
    const list = await dependencies.admin.getMissionsInFlight();
    return c.json(list);
  });

  routes.get("/notifications", requireCapability("mission.read"), async (c) => {
    const [queue, inFlight, reports] = await Promise.all([
      dependencies.admin.getEditingQueue(),
      dependencies.admin.getMissionsInFlight(),
      dependencies.admin.reportsForInspector(),
    ]);
    const notifications = buildAdminNotifications({ queue, inFlight, reports });
    return c.json(notifications);
  });

  routes.on("POST", ["/queue", "/queue/move"], requireCapability("queue.manage"), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const missionId = Number(body?.missionId ?? body?.pautaId ?? body?.id);
    if (!Number.isInteger(missionId) || missionId <= 0)
      return c.json({ error: "Missão inválida." }, 400);
    const movement = (body?.movement ?? body?.movimento ?? "subir") as any;
    const result = await dependencies.admin.moveInQueue(missionId, movement);
    if (!result.ok) return c.json({ error: result.error, erro: result.error }, 400);
    return c.json({ ok: true });
  });

  routes.get("/broadcast/recipients", requireCapability("broadcast.send"), async (c) => {
    const audience = c.req.query("audience") ?? "all";
    let editors: { name: string; email: string }[] = [];
    let spokespersons: { name: string; email: string }[] = [];

    if (audience === "editors" || audience === "all") {
      editors = await dependencies.admin.getActiveEditorEmails();
    }
    if (audience === "spokespersons" || audience === "candidates" || audience === "all") {
      spokespersons = await dependencies.admin.getActiveSpokespersonEmails();
    }
    return c.json({ editors, spokespersons });
  });

  routes.post("/broadcast", requireCapability("broadcast.send"), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const audience = resolveBroadcastAudience(body);
    if (!audience) return c.json({ error: "Público inválido." }, 400);

    const overview = await dependencies.admin.getSystemOverview();
    // O aviso sai com o link do site público, e não com o do Worker da API:
    // a requisição chega repassada pelo web, que preserva a origem original.
    const origin = new URL(c.req.url).origin;

    const notice =
      audience === "editors"
        ? {
            reason: overview.inQueue === 0 ? "Não tem missão esperando na fila." : null,
            recipients: () => dependencies.admin.getActiveEditorEmails(),
            content: (name: string) =>
              buildEditorsQueueEmail(name, overview.inQueue, `${origin}/editor`),
          }
        : {
            reason: overview.freeEditors === 0 ? "Nenhum editor está livre agora." : null,
            recipients: () => dependencies.admin.getActiveSpokespersonEmails(),
            content: (name: string) =>
              buildFreeEditorsEmail(name, overview.freeEditors, `${origin}/porta-voz/nova-pauta`),
          };

    if (notice.reason) return c.json({ error: notice.reason }, 400);

    const recipients = await notice.recipients();
    for (const person of recipients) {
      await queueNoticeEmail(audience, person.email, notice.content(person.name));
    }
    // Drenar sem nada na caixa é uma ida ao banco à toa.
    if (recipients.length > 0) await drainEmailQueueNow();

    return c.json({ ok: true, sent: recipients.length });
  });

  return routes;
}
