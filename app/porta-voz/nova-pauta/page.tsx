import type { Metadata } from "next";
import Link from "next/link";
import { NewMissionForm } from "@/components/new-mission-form";
import { readSession } from "@/lib/server-session";
import { readOwnCandidate } from "@/lib/candidate-db";

export const metadata: Metadata = { title: "Nova Missão — Oficina Amarela" };

export default async function NewMissionPage() {
  const session = await readSession();
  let candidate = null;
  
  if (String(session?.role) === "spokesperson" || String(session?.role) === "voz") {
    candidate = await readOwnCandidate(session!.id);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 lg:px-8">
      <div className="pt-6">
        <Link
          href="/porta-voz"
          className="text-sm text-muted transition-colors hover:text-silver-hi"
        >
          ← Minhas missões
        </Link>
      </div>
      <NewMissionForm
        defaultWatermark={candidate?.watermark ?? (candidate as any)?.marcaDagua}
        defaultCampaignTaxId={candidate?.campaignTaxId ?? (candidate as any)?.cnpjCampanha}
        defaultVoterId={candidate?.voterId ?? (candidate as any)?.tituloEleitor}
      />
    </div>
  );
}
