import type { Metadata } from "next";
import { ActiveMissionCard } from "@/components/active-mission-card";
import { AppHeader } from "@/components/app-header";
import { DailyChallenges } from "@/components/daily-challenges";
import { IncompleteProfileBanner } from "@/components/incomplete-profile-banner";
import { MissionOffer } from "@/components/mission-offer";
import { missionMessages } from "@/lib/chat-db";
import { listDailyChallenges, recordDailyLogin } from "@/lib/gamification-db";
import { reservedMissionBy } from "@/lib/missions-db";
import { readEditorOnboarding } from "@/lib/profile-db";
import { requireSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Fila — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function EditorPage() {
  const session = await requireSession();
  const [currentMission, onboarding] = await Promise.all([
    reservedMissionBy(session.id),
    readEditorOnboarding(session.id),
  ]);
  try {
    await recordDailyLogin(session.id);
  } catch (e) {
    console.error("[gamification] failed to record login", e);
  }
  const challenges = await listDailyChallenges(session.id);
  const isIncompleteProfile = onboarding ? !onboarding.profileComplete : true;
  const messages = currentMission
    ? await missionMessages(Number(currentMission.id.replace(/^db-/, "")))
    : [];

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-12">
          <div className="mb-8">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
              Fila de missões
            </h1>
            <p className="mt-1 text-sm text-muted">
              {currentMission
                ? "Você já tem uma missão em mãos. Entregue pra receber a próxima."
                : "As missões chegam até você, uma por vez. Aceite ou passe — se passar, vai pro próximo editor."}
            </p>
          </div>

          {isIncompleteProfile && (
            <div className="mb-6">
              <IncompleteProfileBanner role="editor" />
            </div>
          )}

          <ActiveMissionCard mission={currentMission} messages={messages} />
          <MissionOffer hasActiveMission={!!currentMission} />

          <div
            aria-hidden="true"
            className="my-10 h-px rounded-full"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(244,206,31,0.35) 30%, rgba(244,206,31,0.5) 50%, rgba(244,206,31,0.35) 70%, transparent 100%)",
            }}
          />

          <DailyChallenges challenges={challenges} />
        </div>
      </main>
    </>
  );
}
