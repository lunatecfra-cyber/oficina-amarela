import { createD1Gamification } from "@oficina/db/d1/gamification";
import { createD1InvitationAdmin } from "@oficina/db/d1/invitation-admin";
import { createD1MissionApproval } from "@oficina/db/d1/mission-approval";
import { createD1MissionCollaboration } from "@oficina/db/d1/mission-collaboration";
import { createD1MissionContacts } from "@oficina/db/d1/mission-contacts";
import { createD1MissionLifecycle } from "@oficina/db/d1/mission-lifecycle";
import { createD1MissionQueue } from "@oficina/db/d1/mission-queue";
import { createD1RankingAdmin } from "@oficina/db/d1/ranking-admin";
import type { D1DatabaseLike } from "@oficina/db/d1/types";
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

/**
 * Conjunto D1.
 *
 * Ou tudo vem do D1, ou tudo vem do PostgreSQL. Misturar as duas pontas
 * partiria users.reputacao entre dois donos — a aprovação de missão soma no
 * D1, a gamificação somaria no PostgreSQL — e nenhum dos dois estaria certo.
 * Por isso a escolha é do conjunto inteiro, não de uma fatia por vez.
 */
export function d1ApiDependencies(db: D1DatabaseLike): ApiDependencies {
  return {
    invitationAdmin: createD1InvitationAdmin(db),
    missionQueue: createD1MissionQueue(db),
    missionLifecycle: createD1MissionLifecycle(db),
    missionCollaboration: createD1MissionCollaboration(db),
    missionApproval: createD1MissionApproval(db),
    missionContacts: createD1MissionContacts(db),
    rankingAdmin: createD1RankingAdmin(db),
    recordGamificationEvent: createD1Gamification(db),
  };
}
