import type { UserSession } from "@oficina/auth/session";
import type { DisputeFailure } from "@oficina/db/disputes";
import { ATTACHMENT_MAX_BYTES } from "@oficina/domain/uploads";
import { Hono } from "hono";
import type { Bindings } from "../app.ts";
import { attachmentResponse, prepareAttachment } from "../attachments.ts";
import type { ApiDependencies } from "../dependencies.ts";
import { requireCapability, requireSession } from "../session.ts";

type Env = { Bindings: Bindings; Variables: { session: UserSession; requestId: string } };

const FAILURE: Record<DisputeFailure, [400 | 403 | 404 | 409 | 501, string]> = {
  not_found: [404, "Disputa não encontrada."],
  forbidden: [403, "Você não pode fazer isso nesta disputa."],
  invalid: [400, "Confira os campos: texto fora dos limites ou opção inválida."],
  conflict: [409, "Outra pessoa já agiu nesta disputa, ou já existe uma disputa em aberto."],
  unavailable: [409, "O estado atual da disputa não permite esta ação."],
  unsupported: [501, "Disputas não estão disponíveis neste banco."],
};

const idOf = (raw: string) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};
const text = (value: unknown) => (typeof value === "string" ? value : "");

export function createDisputeRoutes(dependencies: ApiDependencies) {
  const routes = new Hono<Env>();
  routes.use("*", requireSession);
  const repo = () => dependencies.disputes;
  const fail = (
    c: { json: (body: unknown, status: 400 | 403 | 404 | 409 | 501) => Response },
    reason: DisputeFailure,
  ) => c.json({ error: FAILURE[reason][1] }, FAILURE[reason][0]);
  const actorOf = (c: { get: (key: "session") => UserSession }) => c.get("session");

  routes.post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    const missionId = idOf(String(body?.missionId ?? "").replace(/^db-/, ""));
    if (missionId === null) return c.json({ error: "Informe a missão." }, 400);
    const result = await repo().open(actorOf(c), {
      missionId,
      category: text(body?.category),
      claim: text(body?.claim),
    });
    if (!result.ok) return fail(c, result.reason);
    return c.json({ ok: true, id: result.id }, 201);
  });

  routes.get("/", async (c) => {
    const result = await repo().list(actorOf(c));
    if (!result.ok) return fail(c, result.reason);
    c.header("cache-control", "private, no-store");
    return c.json({ disputes: result.disputes });
  });

  // Mediator grant: people management, audited. Before "/:id".
  routes.put("/mediators/:userId", requireCapability("users.manage"), async (c) => {
    const userId = idOf(c.req.param("userId"));
    if (userId === null) return c.json({ error: "Pessoa inválida." }, 400);
    const result = await repo().setMediator(actorOf(c), userId, true);
    return result.ok ? c.json({ ok: true }) : fail(c, result.reason);
  });
  routes.delete("/mediators/:userId", requireCapability("users.manage"), async (c) => {
    const userId = idOf(c.req.param("userId"));
    if (userId === null) return c.json({ error: "Pessoa inválida." }, 400);
    const result = await repo().setMediator(actorOf(c), userId, false);
    return result.ok ? c.json({ ok: true }) : fail(c, result.reason);
  });

  routes.get("/:id", async (c) => {
    const id = idOf(c.req.param("id"));
    if (id === null) return c.json({ error: "Disputa inválida." }, 400);
    const result = await repo().get(actorOf(c), id);
    if (!result.ok) return fail(c, result.reason);
    c.header("cache-control", "private, no-store");
    return c.json({ dispute: result.dispute });
  });

  // Statement as JSON ({ text }) or multipart (`text` and `file`). The file only goes to R2
  // after authorization and, if the statement is not recorded, the object is given back.
  routes.post("/:id/statements", async (c) => {
    const id = idOf(c.req.param("id"));
    if (id === null) return c.json({ error: "Disputa inválida." }, 400);
    const session = actorOf(c);
    const allowed = await repo().canStatement(session, id);
    if (!allowed.ok) return fail(c, allowed.reason);

    if (!(c.req.header("content-type") ?? "").startsWith("multipart/form-data")) {
      const body = await c.req.json().catch(() => null);
      const result = await repo().addStatement(session, id, text(body?.text));
      return result.ok
        ? c.json({ ok: true, statementId: result.statementId }, 201)
        : fail(c, result.reason);
    }
    if (!c.env.MEDIA) return c.json({ error: "Anexos indisponíveis." }, 503);
    if (Number(c.req.header("content-length") ?? 0) > ATTACHMENT_MAX_BYTES + 64 * 1024)
      return c.json({ error: "O anexo excede 10 MB." }, 413);
    const attempt = await dependencies.accounts.recordAttempt(
      `disputefile:${session.id}`,
      30,
      60,
      60,
    );
    if (attempt.locked) return c.json({ error: "Muitos anexos na última hora." }, 429);
    const form = await c.req.parseBody().catch(() => null);
    const file = form?.file;
    if (!(file instanceof File)) return c.json({ error: "Envie um arquivo." }, 400);
    const prepared = await prepareAttachment(file);
    if (!prepared.ok) return c.json({ error: prepared.error }, prepared.status);
    const { bytes, filename, sha256, contentType, size } = prepared.attachment;
    const objectKey = `dispute/${id}/${crypto.randomUUID()}`;
    await c.env.MEDIA.put(objectKey, bytes, {
      httpMetadata: { contentType },
      customMetadata: { disputeId: String(id), ownerId: String(session.id), sha256 },
    });
    const result = await repo().addStatement(session, id, text(form?.text), {
      objectKey,
      filename,
      contentType,
      size,
      sha256,
    });
    if (!result.ok) {
      await c.env.MEDIA.delete(objectKey).catch(() => {});
      return fail(c, result.reason);
    }
    return c.json({ ok: true, statementId: result.statementId }, 201);
  });

  routes.post("/:id/take", async (c) => {
    const id = idOf(c.req.param("id"));
    if (id === null) return c.json({ error: "Disputa inválida." }, 400);
    const result = await repo().take(actorOf(c), id);
    return result.ok ? c.json({ ok: true }) : fail(c, result.reason);
  });

  routes.post("/:id/decision", async (c) => {
    const id = idOf(c.req.param("id"));
    if (id === null) return c.json({ error: "Disputa inválida." }, 400);
    const body = await c.req.json().catch(() => null);
    const result = await repo().decide(actorOf(c), id, {
      outcome: text(body?.outcome),
      rationale: text(body?.rationale),
      recommendation: text(body?.recommendation),
    });
    return result.ok ? c.json({ ok: true, round: result.round }) : fail(c, result.reason);
  });

  routes.post("/:id/appeal", async (c) => {
    const id = idOf(c.req.param("id"));
    if (id === null) return c.json({ error: "Disputa inválida." }, 400);
    const body = await c.req.json().catch(() => null);
    const result = await repo().appeal(actorOf(c), id, text(body?.reason));
    return result.ok ? c.json({ ok: true }, 201) : fail(c, result.reason);
  });

  routes.post("/:id/close", async (c) => {
    const id = idOf(c.req.param("id"));
    if (id === null) return c.json({ error: "Disputa inválida." }, 400);
    const body = await c.req.json().catch(() => null);
    const result = await repo().close(actorOf(c), id, text(body?.reason));
    return result.ok ? c.json({ ok: true }) : fail(c, result.reason);
  });

  routes.get("/:id/evidence", async (c) => {
    const id = idOf(c.req.param("id"));
    if (id === null) return c.json({ error: "Disputa inválida." }, 400);
    const result = await repo().evidence(actorOf(c), id);
    if (!result.ok) return fail(c, result.reason);
    c.header("cache-control", "private, no-store");
    c.header("content-disposition", `attachment; filename="disputa-${id}-evidencias.json"`);
    return c.json({ disputeId: id, capturedAt: result.capturedAt, evidence: result.items });
  });

  routes.get("/:id/attachments/:attachmentId", async (c) => {
    const id = idOf(c.req.param("id"));
    const attachmentId = idOf(c.req.param("attachmentId"));
    if (id === null || attachmentId === null) return c.json({ error: "Anexo inválido." }, 400);
    if (!c.env.MEDIA) return c.json({ error: "Anexos indisponíveis." }, 503);
    const found = await repo().attachmentFor(actorOf(c), id, attachmentId);
    if (!found.ok) return fail(c, found.reason);
    const object = await c.env.MEDIA.get(found.attachment.objectKey);
    if (!object) return c.json({ error: "Anexo não encontrado." }, 404);
    return attachmentResponse(object, found.attachment);
  });

  return routes;
}
