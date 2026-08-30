import { drainEmailQueueNow } from "@oficina/email/dispatch";
import { type Bindings, configureRuntimeBindings, createApp } from "./app.ts";
import {
  type BackgroundTaskMessage,
  runBackgroundTask,
  runScheduledMaintenance,
} from "./background.ts";
import { postgresApiDependencies } from "./dependencies.ts";

export { MissionCoordinator } from "./durable-objects/mission-coordinator.ts";

const app = createApp();
const backgroundDependencies = {
  missionQueue: postgresApiDependencies.missionQueue,
  drainEmailQueue: drainEmailQueueNow,
};

export default {
  fetch(request, env, context) {
    return app.fetch(request, env, context);
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
