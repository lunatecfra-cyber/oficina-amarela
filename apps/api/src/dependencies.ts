import { recordGamificationEvent } from "@oficina/db/gamification";
import {
  type MissionApprovalRepository,
  postgresMissionApproval,
} from "@oficina/db/mission-approval";
import {
  type MissionCollaborationRepository,
  postgresMissionCollaboration,
} from "@oficina/db/mission-collaboration";
import { missionContacts } from "@oficina/db/mission-contacts";
import {
  type MissionLifecycleRepository,
  postgresMissionLifecycle,
} from "@oficina/db/mission-lifecycle";
import { type MissionQueueRepository, postgresMissionQueue } from "@oficina/db/mission-queue";

export type ApiDependencies = {
  missionQueue: MissionQueueRepository;
  missionLifecycle: MissionLifecycleRepository;
  missionCollaboration: MissionCollaborationRepository;
  missionApproval: MissionApprovalRepository;
  missionContacts: typeof missionContacts;
  recordGamificationEvent: typeof recordGamificationEvent;
};

export const postgresApiDependencies: ApiDependencies = {
  missionQueue: postgresMissionQueue,
  missionLifecycle: postgresMissionLifecycle,
  missionCollaboration: postgresMissionCollaboration,
  missionApproval: postgresMissionApproval,
  missionContacts,
  recordGamificationEvent,
};
