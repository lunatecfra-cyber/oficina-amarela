import type { Metadata } from "next";
import { RankingSecurityPanel } from "@/components/ranking-security-panel";

export const metadata: Metadata = { title: "Painel operacional — Oficina Amarela" };

export default function SecurityRankingPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text">
        Painel operacional do inspetor
      </h1>
      <RankingSecurityPanel />
    </div>
  );
}
