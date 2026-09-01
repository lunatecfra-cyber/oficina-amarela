import type { UserSession } from "@oficina/auth/session";
import { drainEmailQueueNow, queueNoticeEmail } from "@oficina/email/dispatch";
import { buildEditorsQueueEmail, buildFreeEditorsEmail } from "@oficina/email/messages";
import { Hono } from "hono";
import type { Bindings } from "../app.ts";
import type { ApiDependencies } from "../dependencies.ts";
import { requireAdmin } from "../session.ts";

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
  routes.use("*", requireAdmin);

  routes.get("/users", async (c) => {
    const q = c.req.query("q") ?? "";
    const users = await dependencies.admin.searchUsers(q);
    return c.json({ users, usuarios: users, items: users });
  });

  routes.post("/users", async (c) => {
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

  routes.get("/users/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const user = await dependencies.admin.viewUserDetails(id);
    if (!user)
      return c.json({ error: "Conta não encontrada.", erro: "Conta não encontrada." }, 404);
    return c.json({ ...user, user, usuario: user });
  });

  routes.post("/users/:id/ban", async (c) => {
    const id = Number(c.req.param("id"));
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const reason = String(body?.reason ?? body?.motivo ?? "");
    const result = await dependencies.admin.banUser(id, reason);
    if (!result.ok) return c.json({ error: result.error, erro: result.error }, 400);
    return c.json({ ok: true });
  });

  routes.post("/users/:id/unban", async (c) => {
    const id = Number(c.req.param("id"));
    const result = await dependencies.admin.unbanUser(id);
    if (!result.ok) return c.json({ error: result.error, erro: result.error }, 400);
    return c.json({ ok: true });
  });

  routes.delete("/users/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const result = await dependencies.admin.removeUser(id);
    if (!result.ok) return c.json({ error: result.error, erro: result.error }, 400);
    return c.json(result);
  });

  routes.get("/reports", async (c) => {
    const reports = await dependencies.admin.reportsForInspector();
    return c.json({ reports, denuncias: reports, items: reports });
  });

  routes.post("/reports/:id/resolve", async (c) => {
    const id = Number(c.req.param("id"));
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const status = (body?.status ?? "resolvida") as any;
    const result = await dependencies.admin.resolveReport(id, status);
    if (!result.ok) return c.json({ error: result.error, erro: result.error }, 400);
    return c.json({ ok: true });
  });

  routes.get("/overview", async (c) => {
    const overview = await dependencies.admin.getSystemOverview();
    return c.json(overview);
  });

  routes.get("/queue", async (c) => {
    const queue = await dependencies.admin.getEditingQueue();
    return c.json({ queue, fila: queue, items: queue });
  });

  routes.get("/in-flight", async (c) => {
    const list = await dependencies.admin.getMissionsInFlight();
    return c.json(list);
  });

  routes.post("/queue/move", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const missionId = Number(body?.missionId ?? body?.pautaId);
    const movement = (body?.movement ?? body?.movimento ?? "subir") as any;
    const result = await dependencies.admin.moveInQueue(missionId, movement);
    if (!result.ok) return c.json({ error: result.error, erro: result.error }, 400);
    return c.json({ ok: true });
  });

  routes.get("/broadcast/recipients", async (c) => {
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

  routes.post("/broadcast", async (c) => {
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
