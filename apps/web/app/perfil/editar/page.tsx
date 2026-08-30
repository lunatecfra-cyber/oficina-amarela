import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { DeleteAccount } from "@/components/delete-account";
import { EditProfileForm } from "@/components/edit-profile-form";
import { SetPassword } from "@/components/set-password";
import { accountHasPassword, readEditableProfile } from "@/lib/profile-db";
import { requireSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Editar perfil — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function EditProfilePage() {
  const session = await requireSession();
  const [profileOpt, hasPassword] = await Promise.all([
    readEditableProfile(session.id),
    accountHasPassword(session.id),
  ]);
  const profile = profileOpt ?? {
    headline: [],
    bio: null,
    location: null,
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

          <EditProfileForm initial={profile} />

          <div className="max-w-lg">
            <SetPassword hasPassword={hasPassword} />
            <DeleteAccount hasPassword={hasPassword} />
          </div>
        </div>
      </main>
    </>
  );
}
