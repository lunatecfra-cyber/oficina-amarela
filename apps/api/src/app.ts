import { configureDatabaseUrl } from "@oficina/db/client";
import { Hono } from "hono";
import { type ApiDependencies, postgresApiDependencies } from "./dependencies.ts";
import { createEditorQueue } from "./routes/editor-queue.ts";
import { createMissionLifecycleRoutes } from "./routes/mission-lifecycle.ts";

/**
 * Fronteira HTTP da API.
 *
 * Ainda sem rotas de negócio: elas migram de apps/web progressivamente (fase 6).
 * O que já está fixado aqui é o formato — identificador de requisição, log
 * estruturado, erro e 404 em PT-BR — para as rotas migrarem para um contrato
 * pronto em vez de cada uma inventar o seu.
 */

export type Bindings = {
  HYPERDRIVE?: { readonly connectionString: string };
};

export type Variables = {
  requestId: string;
};

export function createApp(dependencies: ApiDependencies = postgresApiDependencies) {
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  // Identificador de requisição: aproveita o do Cloudflare quando existe, para
  // o log do Worker e o do aplicativo apontarem para a mesma requisição.
  app.use("*", async (c, next) => {
    const requestId = c.req.header("cf-ray") ?? crypto.randomUUID();
    c.set("requestId", requestId);
    c.header("x-request-id", requestId);

    const hyperdriveUrl = c.env?.HYPERDRIVE?.connectionString;
    if (hyperdriveUrl) configureDatabaseUrl(hyperdriveUrl);

    const startedAt = Date.now();
    await next();

    console.log(
      JSON.stringify({
        requestId,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Date.now() - startedAt,
      }),
    );
  });

  app.get("/health", (c) => c.json({ ok: true, service: "oficina-amarela-api" }));

  app.route("/editor/queue", createEditorQueue(dependencies));
  app.route("/missions", createMissionLifecycleRoutes(dependencies));

  app.notFound((c) =>
    c.json({ error: "Rota não encontrada.", requestId: c.get("requestId") }, 404),
  );

  app.onError((error, c) => {
    const requestId = c.get("requestId");
    console.error(JSON.stringify({ requestId, error: String(error) }));
    // Mensagem pública em PT-BR e sem detalhe interno; o rastro fica no log.
    return c.json({ error: "Algo deu errado por aqui. Tente de novo.", requestId }, 500);
  });

  return app;
}
