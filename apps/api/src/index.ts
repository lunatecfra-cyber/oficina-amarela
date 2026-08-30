import { drainEmailQueueNow } from "@oficina/email/dispatch";
import { type Bindings, configureRuntimeBindings, createApp, dependenciesFor } from "./app.ts";
import {
  type BackgroundTaskMessage,
  runBackgroundTask,
  runScheduledMaintenance,
} from "./background.ts";
import { postgresApiDependencies } from "./dependencies.ts";

export { MissionCoordinator } from "./durable-objects/mission-coordinator.ts";

const backgroundDependencies = {
  missionQueue: postgresApiDependencies.missionQueue,
  drainEmailQueue: drainEmailQueueNow,
};

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
    await runScheduledMaintenance(backgroundDependencies);
  },
  async queue(batch, env) {
    configureRuntimeBindings(env);
    for (const message of batch.messages) {
      await runBackgroundTask(backgroundDependencies, message.body);
    }
  },
} satisfies ExportedHandler<Bindings, BackgroundTaskMessage>;
