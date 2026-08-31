import { configureDatabaseUrl, withRequestDatabase } from "@oficina/db/client";
import { createD1EmailQueueSource } from "@oficina/db/d1/email-queue";
import { createD1SessionRevocationSource } from "@oficina/db/d1/session-revocation";
import {
  configureEmailQueueSource,
  MAX_ATTEMPTS as EMAIL_MAX_ATTEMPTS,
} from "@oficina/db/email-queue";
import { configureSessionRevocationSource } from "@oficina/db/session-revocation";
import { Hono } from "hono";
import {
  type ApiDependencies,
  d1ApiDependencies,
  postgresApiDependencies,
} from "./dependencies.ts";
import { createAdminInvitationRoutes } from "./routes/admin-invitations.ts";
import { createAdminRankingRoutes } from "./routes/admin-ranking.ts";
import { createAdminManagementRoutes } from "./routes/admin-routes.ts";
import { createAuthRoutes } from "./routes/auth.ts";
import { createContentRoutes } from "./routes/content.ts";
import { createEditorQueue } from "./routes/editor-queue.ts";
import { createMissionCollaborationRoutes } from "./routes/mission-collaboration.ts";
import { createMissionLifecycleRoutes } from "./routes/mission-lifecycle.ts";
import { createMissionsCrudRoutes } from "./routes/missions-crud.ts";
import { createProfileRoutes } from "./routes/profiles.ts";
import { createRankingRoutes } from "./routes/ranking.ts";

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
  /**
   * Produtor da fila de manutenção. A presença dele é o interruptor: com fila
   * e Cron no ar, a manutenção é deles, e a varredura por requisição sai de
   * cena. Sem binding — local e teste — a requisição continua sendo o gatilho.
   */
  BACKGROUND_QUEUE?: { send(message: unknown): Promise<void> };
  /**
   * Banco D1. Quando existe, é ele quem atende: o conjunto de repositórios é
   * escolhido inteiro (ver d1ApiDependencies), nunca fatia a fatia.
   */
  DB?: unknown;
  MISSION_COORDINATOR?: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
  };
};

export type Variables = {
  requestId: string;
};

export function configureRuntimeBindings(bindings: Bindings | undefined): void {
  const hyperdriveUrl = bindings?.HYPERDRIVE?.connectionString;
  if (hyperdriveUrl) configureDatabaseUrl(hyperdriveUrl);

  // A revogação de sessão acontece no middleware, longe do conjunto de
  // repositórios injetado. Ela precisa seguir a mesma escolha de banco, senão
  // um Worker servido por D1 autentica contra um PostgreSQL que não existe.
  configureSessionRevocationSource(
    bindings?.DB ? createD1SessionRevocationSource(bindings.DB as never) : null,
  );

  // Mesma razão: a caixa de saída é drenada pelo Cron e pelo consumidor de
  // fila, fora do conjunto injetado nas rotas.
  configureEmailQueueSource(
    bindings?.DB ? createD1EmailQueueSource(bindings.DB as never, EMAIL_MAX_ATTEMPTS) : null,
  );
}

/**
 * Qual banco atende esta requisição.
 *
 * Com o binding D1 no ar, o conjunto inteiro vem do D1. Sem ele, PostgreSQL —
 * direto por DATABASE_URL no local, ou pelo Hyperdrive no Worker.
 */
export function dependenciesFor(
  env: Bindings | undefined,
  fallback: ApiDependencies,
): ApiDependencies {
  return env?.DB ? d1ApiDependencies(env.DB as never) : fallback;
}

export function createApp(dependencies: ApiDependencies = postgresApiDependencies) {
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

  // Identificador de requisição: aproveita o do Cloudflare quando existe, para
  // o log do Worker e o do aplicativo apontarem para a mesma requisição.
  app.use("*", async (c, next) => {
    const requestId = c.req.header("cf-ray") ?? crypto.randomUUID();
    c.set("requestId", requestId);
    c.header("x-request-id", requestId);

    configureRuntimeBindings(c.env);

    const startedAt = Date.now();
    // Cada requisição roda com o seu próprio cliente PostgreSQL: no workerd um
    // socket não atravessa requisições. Ver withRequestDatabase.
    await withRequestDatabase(() => next());

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

  app.route("/admin/invitations", createAdminInvitationRoutes(dependencies));
  app.route("/admin/ranking", createAdminRankingRoutes(dependencies));
  app.route("/", createContentRoutes(dependencies));
  app.route("/admin", createAdminManagementRoutes(dependencies));
  app.route("/auth", createAuthRoutes(dependencies));
  app.route("/editor/queue", createEditorQueue(dependencies));
  app.route("/missions", createMissionCollaborationRoutes(dependencies));
  app.route("/missions", createMissionLifecycleRoutes(dependencies));
  app.route("/", createRankingRoutes(dependencies));
  app.route("/", createProfileRoutes(dependencies));
  app.route("/", createMissionsCrudRoutes(dependencies));

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
