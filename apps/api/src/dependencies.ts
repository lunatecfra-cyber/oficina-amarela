import { type AccountsRepository, postgresAccounts } from "@oficina/db/accounts";
import { type AdminRepository, postgresAdmin } from "@oficina/db/admin";
import { createD1Accounts } from "@oficina/db/d1/accounts";
import { createD1Admin } from "@oficina/db/d1/admin";
import { createD1Gamification } from "@oficina/db/d1/gamification";
import { createD1InvitationAdmin } from "@oficina/db/d1/invitation-admin";
import { createD1InvitationRedemption } from "@oficina/db/d1/invitation-redemption";
import { createD1MissionApproval } from "@oficina/db/d1/mission-approval";
import { createD1MissionCollaboration } from "@oficina/db/d1/mission-collaboration";
import { createD1MissionContacts } from "@oficina/db/d1/mission-contacts";
import { createD1MissionLifecycle } from "@oficina/db/d1/mission-lifecycle";
import { createD1MissionQueue } from "@oficina/db/d1/mission-queue";
import { createD1Missions } from "@oficina/db/d1/missions";
import { createD1Music } from "@oficina/db/d1/music";
import { createD1News } from "@oficina/db/d1/news";
import { createD1Profiles } from "@oficina/db/d1/profiles";
import { createD1Ranking } from "@oficina/db/d1/ranking";
import { createD1RankingAdmin } from "@oficina/db/d1/ranking-admin";
import type { D1DatabaseLike } from "@oficina/db/d1/types";
import {
  type GamificationRepository,
  postgresGamification,
  recordGamificationEvent,
} from "@oficina/db/gamification";
import {
  type InvitationAdminRepository,
  postgresInvitationAdmin,
} from "@oficina/db/invitation-admin";
import {
  type InvitationRedemptionRepository,
  postgresInvitationRedemption,
} from "@oficina/db/invitation-redemption";
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
import { type MissionsRepository, postgresMissions } from "@oficina/db/missions";
import { type MusicRepository, postgresMusic } from "@oficina/db/music";
import { type NewsRepository, postgresNews } from "@oficina/db/news";
import { type ProfilesRepository, postgresProfiles } from "@oficina/db/profiles";
import { postgresRanking, type RankingRepository } from "@oficina/db/ranking";
import { postgresRankingAdmin, type RankingAdminRepository } from "@oficina/db/ranking-admin";
import { invalidateSessionRevocation } from "@oficina/db/session-revocation";

export type ApiDependencies = {
  accounts: AccountsRepository;
  admin: AdminRepository;
  invitationAdmin: InvitationAdminRepository;
  invitationRedemption: InvitationRedemptionRepository;
  /** Envia o link de recuperação. Recebe o id porque o token é derivado dele. */
  sendRecoveryEmail: (userId: number, email: string, name: string) => Promise<void>;
  invalidateSessionRevocation: (userId: number) => void;
  missionQueue: MissionQueueRepository;
  missionLifecycle: MissionLifecycleRepository;
  missionCollaboration: MissionCollaborationRepository;
  missionApproval: MissionApprovalRepository;
  missionContacts: typeof missionContacts;
  missions: MissionsRepository;
  music: MusicRepository;
  news: NewsRepository;
  profiles: ProfilesRepository;
  ranking: RankingRepository;
  rankingAdmin: RankingAdminRepository;
  recordGamificationEvent: typeof recordGamificationEvent;
  gamification: GamificationRepository;
};

export const postgresApiDependencies: ApiDependencies = {
  accounts: postgresAccounts,
  admin: postgresAdmin,
  invitationAdmin: postgresInvitationAdmin,
  invitationRedemption: postgresInvitationRedemption,
  sendRecoveryEmail,
  invalidateSessionRevocation,
  missionQueue: postgresMissionQueue,
  missionLifecycle: postgresMissionLifecycle,
  missionCollaboration: postgresMissionCollaboration,
  missionApproval: postgresMissionApproval,
  missionContacts,
  missions: postgresMissions,
  music: postgresMusic,
  news: postgresNews,
  profiles: postgresProfiles,
  ranking: postgresRanking,
  rankingAdmin: postgresRankingAdmin,
  recordGamificationEvent,
  gamification: postgresGamification,
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
  const d1Gamification = createD1Gamification(db);
  return {
    accounts: createD1Accounts(db),
    admin: createD1Admin(db),
    invitationAdmin: createD1InvitationAdmin(db),
    invitationRedemption: createD1InvitationRedemption(db),
    sendRecoveryEmail,
    invalidateSessionRevocation,
    missionQueue: createD1MissionQueue(db),
    missionLifecycle: createD1MissionLifecycle(db),
    missionCollaboration: createD1MissionCollaboration(db),
    missionApproval: createD1MissionApproval(db),
    missionContacts: createD1MissionContacts(db),
    missions: createD1Missions(db),
    music: createD1Music(db),
    news: createD1News(db),
    profiles: createD1Profiles(db),
    ranking: createD1Ranking(db),
    rankingAdmin: createD1RankingAdmin(db),
    recordGamificationEvent: d1Gamification,
    gamification: d1Gamification,
  };
}

/**
 * Link de recuperação de senha.
 *
 * O token é derivado do id e carimbado com o instante de emissão; trocar a
 * senha move o corte de sessão para frente e invalida qualquer link anterior.
 */
async function sendRecoveryEmail(userId: number, email: string, name: string): Promise<void> {
  const { createRecoveryToken } = await import("@oficina/auth/session");
  const { sendPasswordRecoveryEmail } = await import("@oficina/email/messages");
  const token = await createRecoveryToken(userId);
  const origin = process.env.PUBLIC_ORIGIN ?? "https://oficinaamarela.com.br";
  await sendPasswordRecoveryEmail(email, name, `${origin}/redefinir-senha?token=${token}`);
}
