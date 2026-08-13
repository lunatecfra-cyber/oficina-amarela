import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { EditarPerfilForm } from "@/components/editar-perfil-form";
import { ApagarConta } from "@/components/apagar-conta";
import { DefinirSenha } from "@/components/definir-senha";
import { contaTemSenha } from "@/lib/contas";
import { lerPerfilEditavel } from "@/lib/perfil-db";
import { exigirSessao } from "@/lib/sessao-servidor";

export const metadata: Metadata = { title: "Editar perfil — Oficina Amarela" };

export const dynamic = "force-dynamic";

export default async function EditarPerfilPage() {
  const sessao = await exigirSessao();
  const [perfilOpt, temSenha] = await Promise.all([
    lerPerfilEditavel(sessao.id),
    contaTemSenha(sessao.id),
  ]);
  const perfil = perfilOpt ?? {
    headline: [],
    bio: null,
    localizacao: null,
  };

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-12">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
            Editar perfil
          </h1>
          <p className="mt-1 mb-8 text-sm text-muted">
            É isso que porta-vozes veem quando olham quem você é.
          </p>

          <EditarPerfilForm inicial={perfil} />

          <div className="max-w-lg">
            <DefinirSenha temSenha={temSenha} />
            <ApagarConta temSenha={temSenha} />
          </div>
        </div>
      </main>
    </>
  );
}
