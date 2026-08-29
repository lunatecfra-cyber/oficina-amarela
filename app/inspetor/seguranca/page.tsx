import type { Metadata } from "next";
import { SegurancaRankingPainel } from "@/components/seguranca-ranking-painel";

export const metadata: Metadata = { title: "Segurança e ranking — Oficina Amarela" };

export default function SegurancaRankingPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text">
        Segurança e ranking
      </h1>
      <SegurancaRankingPainel />
    </div>
  );
}
