import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { CreateEditorProfileForm } from "@/components/create-editor-profile-form";
import { readEditorOnboarding } from "@/lib/profile-db";
import { requireSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Montar perfil — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function CreateEditorProfilePage() {
  const session = await requireSession();
  const initial = (await readEditorOnboarding(session.id)) ?? {
    name: session.name,
    photoUrl: "",
    location: "",
    headline: [],
    bio: "",
    softwares: [],
    styles: [],
    editingLevel: "",
    pcSetup: "",
    portfolioLink: "",
    niche: [],
    availability: [],
    profileComplete: false,
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
            Três passos rápidos. É com isso que a Oficina escolhe quais missões oferecer pra você.
          </p>
        </div>
        <CreateEditorProfileForm initial={initial} />
      </main>
    </>
  );
}
