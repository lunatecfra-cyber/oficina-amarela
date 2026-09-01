import { withRequestDatabase } from "@oficina/db/client";
import { D1MetricsCollector, runWithD1Metrics } from "@oficina/db/d1/instrumentation";
import { drainEmailQueueNow } from "@oficina/email/dispatch";
import { type Bindings, configureRuntimeBindings, createApp, dependenciesFor } from "./app.ts";
import {
  type BackgroundTaskMessage,
  enqueueScheduledMaintenance,
  runBackgroundTask,
  runScheduledMaintenance,
} from "./background.ts";
import { postgresApiDependencies } from "./dependencies.ts";
import { recordBackgroundTelemetry } from "./telemetry.ts";

export { MissionCoordinator } from "./durable-objects/mission-coordinator.ts";

/**
 * O Cron e o consumidor de fila escolhem o banco igual ao fetch.
 *
 * Antes eles usavam postgresApiDependencies fixo, montado em escopo de módulo.
 * Em staging e produção não existe PostgreSQL, então a manutenção agendada
 * lançava "DATABASE_URL not configured" a cada minuto: oferta nunca expirava e
 * a caixa de saída nunca drenava.
 */
function backgroundDependenciesFor(env: Bindings | undefined) {
  return {
    missionQueue: dependenciesFor(env, postgresApiDependencies).missionQueue,
    drainEmailQueue: drainEmailQueueNow,
  };
}

/**
 * O conjunto de repositórios depende do binding, que só existe em tempo de
 * requisição — mas é estável dentro de um isolate. Por isso a aplicação é
 * montada uma vez e reaproveitada, e só refeita se o binding trocar.
 */
let cachedApp: ReturnType<typeof createApp> | undefined;
let cachedDatabase: unknown;

function appFor(env: Bindings | undefined) {
  if (!cachedApp || cachedDatabase !== env?.DB) {
    cachedDatabase = env?.DB;
    cachedApp = createApp(dependenciesFor(env, postgresApiDependencies));
  }
  return cachedApp;
}

export default {
  fetch(request, env, context) {
    return appFor(env).fetch(request, env, context);
  },
  async scheduled(_controller, env) {
    configureRuntimeBindings(env);
    const start = performance.now();

    // Com fila no ar, o Cron só publica: quem executa é o consumidor, que tem
    // retentativa e dead letter queue. Sem fila — local e teste — o Cron faz o
    // trabalho ele mesmo.
    if (env?.BACKGROUND_QUEUE) {
      const count = await enqueueScheduledMaintenance(env.BACKGROUND_QUEUE);
      const durationMs = Number((performance.now() - start).toFixed(2));
      console.log(JSON.stringify({ event: "cron-enqueued", tasks: count, durationMs }));
      recordBackgroundTelemetry(env?.TELEMETRY ?? env?.ANALYTICS, {
        task: "cron-enqueue",
        durationMs,
        success: true,
      });
      return;
    }

    const collector = new D1MetricsCollector();
    let success = true;
    try {
      await runWithD1Metrics(collector, () =>
        withRequestDatabase(() => runScheduledMaintenance(backgroundDependenciesFor(env))),
      );
    } catch (err) {
      success = false;
      console.error("[cron-error]", err);
      throw err;
    } finally {
      const durationMs = Number((performance.now() - start).toFixed(2));
      const d1 = collector.getSummary();
      console.log(
        JSON.stringify({
          event: "cron-executed",
          durationMs,
          success,
          ...(d1.queries > 0 ? { d1 } : {}),
        }),
      );
      recordBackgroundTelemetry(env?.TELEMETRY ?? env?.ANALYTICS, {
        task: "cron-maintenance",
        durationMs,
        success,
        d1,
      });
    }
  },
  async queue(batch, env) {
    configureRuntimeBindings(env);
    const start = performance.now();
    const dependencies = backgroundDependenciesFor(env);
    const collector = new D1MetricsCollector();
    let success = true;

    try {
      await runWithD1Metrics(collector, () =>
        withRequestDatabase(async () => {
          for (const message of batch.messages) {
            const taskStart = performance.now();
            const result = await runBackgroundTask(dependencies, message.body);
            const taskDurationMs = Number((performance.now() - taskStart).toFixed(2));
            console.log(
              JSON.stringify({
                event: "queue-task-processed",
                task: (message.body as { type?: string })?.type,
                durationMs: taskDurationMs,
                result,
              }),
            );
          }
        }),
      );
    } catch (err) {
      success = false;
      console.error("[queue-error]", err);
      throw err;
    } finally {
      const durationMs = Number((performance.now() - start).toFixed(2));
      const d1 = collector.getSummary();
      console.log(
        JSON.stringify({
          event: "queue-batch-completed",
          batchSize: batch.messages.length,
          durationMs,
          success,
          ...(d1.queries > 0 ? { d1 } : {}),
        }),
      );
      recordBackgroundTelemetry(env?.TELEMETRY ?? env?.ANALYTICS, {
        task: "queue-batch",
        durationMs,
        success,
        d1,
      });
    }
  },
} satisfies ExportedHandler<Bindings, BackgroundTaskMessage>;
