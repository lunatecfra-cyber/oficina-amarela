import { PENDING_COOKIE_NAME, verifyPendingIdentity } from "@oficina/auth/session";
import { ROLE_LIMITS } from "@oficina/domain/limits";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ChooseRoleForm } from "@/components/choose-role-form";
import { Logo } from "@/components/logo";
import { fetchApiJson } from "@/lib/internal-api";

export const metadata: Metadata = { title: "Quase lá — Oficina Amarela" };

export const dynamic = "force-dynamic";

export default async function ChooseRolePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_COOKIE_NAME)?.value;
  const pending = token ? await verifyPendingIdentity(token) : null;

  if (!pending) {
    redirect(`/login?google_error=${encodeURIComponent("Sessão expirou, tenta de novo.")}`);
  }

  const slotData = await fetchApiJson<{
    editor: { total: number; free: number; livres: number; enrolled: number };
    spokesperson: { total: number; free: number; livres: number; enrolled: number };
    voz: { total: number; free: number; livres: number; enrolled: number };
  }>("/slots");

  const slots = {
    editor: slotData?.editor ?? {
      total: ROLE_LIMITS.editor,
      livres: ROLE_LIMITS.editor,
    },
    spokesperson: slotData?.spokesperson ?? {
      total: ROLE_LIMITS.spokesperson,
      livres: ROLE_LIMITS.spokesperson,
    },
    voz: slotData?.voz ?? {
      total: ROLE_LIMITS.spokesperson,
      livres: ROLE_LIMITS.spokesperson,
    },
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-14">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size="large" showName={false} />
        <p className="text-gold-grad mt-3 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[0.15em]">
          OFICINA AMARELA
        </p>
      </div>
      <ChooseRoleForm name={pending.name} picture={pending.picture} slots={slots} />
    </main>
  );
}
