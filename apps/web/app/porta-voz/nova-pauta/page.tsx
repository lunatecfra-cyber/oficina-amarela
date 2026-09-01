import type { Metadata } from "next";
import Link from "next/link";
import { NewMissionForm } from "@/components/new-mission-form";
import { readOwnCandidate } from "@/lib/candidate-db";
import { getSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Nova Missão — Oficina Amarela" };

export default async function NewMissionPage() {
  const session = await getSession();
  let candidate = null;

  if (String(session?.role) === "spokesperson" || String(session?.role) === "voz") {
    candidate = await readOwnCandidate(session!.id);
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* px-5 igual ao do formulário, e o -ml-3 desconta o padding interno do
          tap-target: assim o TEXTO nasce nos mesmos 20px dos campos. Com px-2
          a caixa do link começava em -4px, fora da tela. */}
      <div className="px-5 pt-4">
        {/* tap-target: sem ela o alvo ficava em 18px de altura, longe dos 44 */}
        <Link
          href="/porta-voz"
          className="tap-target -ml-3 text-sm text-muted hover:text-silver-hi"
        >
          ← Minhas missões
        </Link>
      </div>
      <NewMissionForm
        defaultWatermark={candidate?.watermark ?? (candidate as any)?.marcaDagua}
        defaultCampaignTaxId={candidate?.campaignTaxId ?? (candidate as any)?.cnpjCampanha}
        defaultCandidateNumber={candidate?.candidateNumber ?? candidate?.numeroEleitoral}
        defaultVoterId={candidate?.voterId ?? (candidate as any)?.tituloEleitor}
      />
    </div>
  );
}
