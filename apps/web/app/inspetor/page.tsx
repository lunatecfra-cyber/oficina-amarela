import type { Metadata } from "next";
import { InspectorQueue } from "@/components/inspector-queue";
import { readCandidatesByHandles } from "@/lib/candidate-db";
import { missionsMessages } from "@/lib/chat-db";
import { missionsInReview } from "@/lib/missions-db";

export const metadata: Metadata = { title: "Controle de Qualidade — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function InspectorPage() {
  const realMissions = await missionsInReview();
  const handles = realMissions
    .map((p) => p.spokespersonHandle ?? (p as any).portaVozApelido)
    .filter((h): h is string => Boolean(h));

  const ids = realMissions.map((p) => Number(p.id.replace(/^db-/, "")));
  const [candidatesMap, messagesMap] = await Promise.all([
    readCandidatesByHandles([...new Set(handles)]),
    missionsMessages(ids),
  ]);
  const candidatesByHandle = Object.fromEntries(candidatesMap);
  const messagesByMission = Object.fromEntries(messagesMap);

  return (
    <InspectorQueue
      realMissions={realMissions}
      candidatesByHandle={candidatesByHandle}
      messagesByMission={messagesByMission}
    />
  );
}
