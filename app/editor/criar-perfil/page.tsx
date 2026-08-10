import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { CriarPerfilEditorForm } from "@/components/criar-perfil-editor-form";
import { lerOnboardingEditor } from "@/lib/perfil-db";
import { exigirSessao } from "@/lib/sessao-servidor";

export const metadata: Metadata = { title: "Montar perfil — Oficina Amarela" };

export const dynamic = "force-dynamic";

export default async function CriarPerfilEditorPage() {
  const sessao = await exigirSessao();
  const inicial = (await lerOnboardingEditor(sessao.id)) ?? {
    nome: sessao.nome,
    fotoUrl: "",
    localizacao: "",
    headline: [],
    bio: "",
    softwares: [],
    estilos: [],
    nivelEdicao: "",
    setupPc: "",
    portfolioLink: "",
    nicho: [],
    disponibilidade: [],
    perfilCompleto: false,
  };

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col items-center px-5 py-8 lg:py-12">
        <div className="w-full max-w-2xl">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
            Monte sua bancada
          </h1>
          <p className="mt-1 mb-8 text-sm text-muted">
            Três passos rápidos. É com isso que a Oficina te indica as pautas certas.
          </p>
        </div>
        <CriarPerfilEditorForm inicial={inicial} />
      </main>
    </>
  );
}
