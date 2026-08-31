import { withRequestDatabase } from "@oficina/db/client";
import { drainEmailQueueNow } from "@oficina/email/dispatch";
import { type Bindings, configureRuntimeBindings, createApp, dependenciesFor } from "./app.ts";
import {
  type BackgroundTaskMessage,
  enqueueScheduledMaintenance,
  runBackgroundTask,
  runScheduledMaintenance,
} from "./background.ts";
import { postgresApiDependencies } from "./dependencies.ts";

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

    // Com fila no ar, o Cron só publica: quem executa é o consumidor, que tem
    // retentativa e dead letter queue. Sem fila — local e teste — o Cron faz o
    // trabalho ele mesmo.
    if (env?.BACKGROUND_QUEUE) {
      await enqueueScheduledMaintenance(env.BACKGROUND_QUEUE);
      return;
    }

    await withRequestDatabase(() => runScheduledMaintenance(backgroundDependenciesFor(env)));
  },
  async queue(batch, env) {
    configureRuntimeBindings(env);
    const dependencies = backgroundDependenciesFor(env);
    await withRequestDatabase(async () => {
      for (const message of batch.messages) {
        await runBackgroundTask(dependencies, message.body);
      }
    });
  },
} satisfies ExportedHandler<Bindings, BackgroundTaskMessage>;
