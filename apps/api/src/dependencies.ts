import { recordGamificationEvent } from "@oficina/db/gamification";
import {
  type InvitationAdminRepository,
  postgresInvitationAdmin,
} from "@oficina/db/invitation-admin";
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
import { postgresRankingAdmin, type RankingAdminRepository } from "@oficina/db/ranking-admin";

export type ApiDependencies = {
  invitationAdmin: InvitationAdminRepository;
  missionQueue: MissionQueueRepository;
  missionLifecycle: MissionLifecycleRepository;
  missionCollaboration: MissionCollaborationRepository;
  missionApproval: MissionApprovalRepository;
  missionContacts: typeof missionContacts;
  rankingAdmin: RankingAdminRepository;
  recordGamificationEvent: typeof recordGamificationEvent;
};

export const postgresApiDependencies: ApiDependencies = {
  invitationAdmin: postgresInvitationAdmin,
  missionQueue: postgresMissionQueue,
  missionLifecycle: postgresMissionLifecycle,
  missionCollaboration: postgresMissionCollaboration,
  missionApproval: postgresMissionApproval,
  missionContacts,
  rankingAdmin: postgresRankingAdmin,
  recordGamificationEvent,
};
