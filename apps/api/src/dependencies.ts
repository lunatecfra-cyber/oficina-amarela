import { recordGamificationEvent } from "@oficina/db/gamification";
import { missionContacts } from "@oficina/db/mission-contacts";
import {
  type MissionLifecycleRepository,
  postgresMissionLifecycle,
} from "@oficina/db/mission-lifecycle";
import { type MissionQueueRepository, postgresMissionQueue } from "@oficina/db/mission-queue";

export type ApiDependencies = {
  missionQueue: MissionQueueRepository;
  missionLifecycle: MissionLifecycleRepository;
  missionContacts: typeof missionContacts;
  recordGamificationEvent: typeof recordGamificationEvent;
};

export const postgresApiDependencies: ApiDependencies = {
  missionQueue: postgresMissionQueue,
  missionLifecycle: postgresMissionLifecycle,
  missionContacts,
  recordGamificationEvent,
};
