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
    //
    // Se a publicação falhar, o Cron executa a manutenção em linha em vez de
    // estourar. Sem isto, o estouro da cota diária de operações de Queue virou
    // parada total: `.send()` passou a recusar, nada tratava a rejeição, e das
    // ~14h à meia-noite UTC nenhuma oferta expirou e nenhum e-mail saiu — 639
    // invocações seguidas terminando em scriptThrewException. Ver
    // docs/infra/cloudflare-queues-incident-2026-09-02.md.
    if (env?.BACKGROUND_QUEUE) {
      try {
        const count = await enqueueScheduledMaintenance(env.BACKGROUND_QUEUE);
        const durationMs = Number((performance.now() - start).toFixed(2));
        console.log(JSON.stringify({ event: "cron-enqueued", tasks: count, durationMs }));
        recordBackgroundTelemetry(env?.TELEMETRY ?? env?.ANALYTICS, {
          task: "cron-enqueue",
          durationMs,
          success: true,
        });
        return;
      } catch (err) {
        // Publicar é o caminho preferido, não o único. Segue para a execução em
        // linha abaixo: melhor um tique mais lento do que um tique perdido.
        console.error("[cron-enqueue-error] publicando falhou, executando em linha", err);
        recordBackgroundTelemetry(env?.TELEMETRY ?? env?.ANALYTICS, {
          task: "cron-enqueue",
          durationMs: Number((performance.now() - start).toFixed(2)),
          success: false,
        });
      }
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

    // Cada mensagem é confirmada ou retentada por conta própria.
    //
    // Antes o laço não tratava nada e o handler estourava: uma mensagem ruim
    // retentava o LOTE inteiro, incluindo as que já tinham sido processadas com
    // sucesso. Com max_batch_size 10 isso custa 10 leituras por retentativa (30
    // no total) e reprocessa trabalho já feito. Com ack/retry por mensagem, só a
    // que falhou volta — e ela ainda vai para a DLQ ao esgotar as tentativas,
    // que é o contrato exercido por queue-config.test.ts.
    let failed = 0;
    try {
      await runWithD1Metrics(collector, () =>
        withRequestDatabase(async () => {
          for (const message of batch.messages) {
            const taskStart = performance.now();
            const task = (message.body as { type?: string })?.type;
            try {
              const result = await runBackgroundTask(dependencies, message.body);
              message.ack();
              console.log(
                JSON.stringify({
                  event: "queue-task-processed",
                  task,
                  durationMs: Number((performance.now() - taskStart).toFixed(2)),
                  result,
                }),
              );
            } catch (err) {
              failed++;
              message.retry();
              console.error(
                JSON.stringify({
                  event: "queue-task-failed",
                  task,
                  durationMs: Number((performance.now() - taskStart).toFixed(2)),
                  error: String(err),
                }),
              );
            }
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
          failed,
          durationMs,
          success,
          ...(d1.queries > 0 ? { d1 } : {}),
        }),
      );
      recordBackgroundTelemetry(env?.TELEMETRY ?? env?.ANALYTICS, {
        task: "queue-batch",
        durationMs,
        success: success && failed === 0,
        d1,
      });
    }
  },
} satisfies ExportedHandler<Bindings, BackgroundTaskMessage>;
