import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { NewDisputeForm } from "@/components/dispute-forms";
import { requireSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Abrir disputa — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function NewDisputePage({
  searchParams,
}: {
  searchParams: Promise<{ missao?: string }>;
}) {
  await requireSession();
  const missionId = Number((await searchParams).missao);
  if (!Number.isInteger(missionId) || missionId <= 0) redirect("/disputas");

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-xl px-5 py-8 lg:px-8 lg:py-12">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text">
            Abrir disputa
          </h1>
          <p className="mt-1 text-sm text-muted">
            Conte o que aconteceu. O estado da missão, a conversa e as entregas ficam registrados no
            momento da abertura. A outra parte poderá responder.
          </p>
          <div className="mt-6">
            <NewDisputeForm missionId={missionId} />
          </div>
        </div>
      </main>
    </>
  );
}
