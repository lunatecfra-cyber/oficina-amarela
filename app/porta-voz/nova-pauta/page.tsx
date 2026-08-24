import type { Metadata } from "next";
import Link from "next/link";
import { NovaPautaForm } from "@/components/nova-pauta-form";
import { lerSessao } from "@/lib/sessao-servidor";
import { lerCandidatoProprio } from "@/lib/candidato-db";

export const metadata: Metadata = { title: "Nova Missão — Oficina Amarela" };

export default async function NovaPautaPage() {
  const sessao = await lerSessao();
  let candidato = null;
  
  if (sessao?.papel === "voz") {
    candidato = await lerCandidatoProprio(sessao.id);
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
      <NovaPautaForm 
        marcaDaguaPadrao={candidato?.marcaDagua}
        cnpjCampanhaPadrao={candidato?.cnpjCampanha}
        tituloEleitorPadrao={candidato?.tituloEleitor}
      />
    </div>
  );
}
