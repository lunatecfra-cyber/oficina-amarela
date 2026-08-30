import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccount } from "@/components/delete-account";
import { EditCandidateProfileForm } from "@/components/edit-candidate-profile-form";
import { SetPassword } from "@/components/set-password";
import { readCandidateOnboarding } from "@/lib/candidate-db";
import { accountHasPassword } from "@/lib/profile-db";
import { requireSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Editar perfil — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function EditSpokespersonProfilePage() {
  const session = await requireSession();
  const [dbOnboarding, hasPassword] = await Promise.all([
    readCandidateOnboarding(session.id),
    accountHasPassword(session.id),
  ]);

  const initial = dbOnboarding ?? {
    name: session.name,
    photoUrl: "",
    role: "",
    runningFor: "",
    electionYear: "2026",
    location: "",
    causes: [],
    communicationTone: "",
    keywords: [],
    socialLinks: {},
    bio: "",
    profileComplete: false,
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

      <EditCandidateProfileForm initial={initial} />

      <div className="max-w-lg">
        <SetPassword hasPassword={hasPassword} />
        <DeleteAccount hasPassword={hasPassword} />
      </div>
    </div>
  );
}
