import type { Metadata } from "next";
import Link from "next/link";
import { EditarPerfilCandidatoForm } from "@/components/editar-perfil-candidato-form";
import { ApagarConta } from "@/components/apagar-conta";
import { DefinirSenha } from "@/components/definir-senha";
import { lerOnboardingCandidato } from "@/lib/candidato-db";
import { contaTemSenha } from "@/lib/contas";
import { exigirSessao } from "@/lib/sessao-servidor";

export const metadata: Metadata = { title: "Editar perfil — Oficina Amarela" };

export const dynamic = "force-dynamic";

export default async function EditarPerfilCandidatoPage() {
  const sessao = await exigirSessao();
  const [doBanco, temSenha] = await Promise.all([
    lerOnboardingCandidato(sessao.id),
    contaTemSenha(sessao.id),
  ]);

  // conta sem onboarding ainda: começa com o nome da sessão e campos vazios.
  // Assim a página serve pra editar E pra criar de novo, sem redirecionar.
  const inicial = doBanco ?? {
    nome: sessao.nome,
    fotoUrl: "",
    cargo: "",
    disputaPor: "",
    anoEleicao: "2026",
    localizacao: "",
    bandeiras: [],
    tomComunicacao: "",
    palavrasChave: [],
    redes: {},
    bio: "",
    perfilCompleto: false,
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-12">
      <Link
        href="/porta-voz/perfil"
        className="-mt-2 inline-block text-xs font-medium text-muted hover:text-gold-hi"
      >
        ← Voltar pro perfil
      </Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
        Editar perfil
      </h1>
      <p className="mt-1 mb-8 text-sm text-muted">
        Salve o que mudar — é isso que editores e o público vão ver de você.
      </p>

      <EditarPerfilCandidatoForm inicial={inicial} />

      <div className="max-w-lg">
        <DefinirSenha temSenha={temSenha} />
        <ApagarConta temSenha={temSenha} />
      </div>
    </div>
  );
}
