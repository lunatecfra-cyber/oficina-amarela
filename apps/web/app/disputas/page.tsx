import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { DISPUTE_CATEGORY_LABEL, DISPUTE_STATUS_LABEL, listDisputes } from "@/lib/disputes-db";
import { requireSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Disputas — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function DisputesPage() {
  await requireSession();
  const disputes = await listDisputes();

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-8 lg:py-12">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
            Disputas
          </h1>
          <p className="mt-1 text-sm text-muted">
            Para abrir uma disputa, use o link “Abrir disputa” na conversa da missão. Uma decisão
            aqui não aplica nenhuma consequência financeira ou de reputação por conta própria.
          </p>
          {disputes.length === 0 ? (
            <p className="mt-6 rounded-xl border border-line-soft bg-ink-2/40 px-4 py-3 text-sm text-muted">
              Nenhuma disputa por aqui.
            </p>
          ) : (
            <ul className="mt-6 flex flex-col gap-2">
              {disputes.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/disputas/${d.id}`}
                    className="block rounded-xl border border-line bg-surface/70 px-4 py-3 hover:border-gold-lo/60"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-text">{d.missionTitle}</span>
                      <span className="rounded border border-line px-1.5 py-px text-[11px] uppercase tracking-wider text-muted">
                        {DISPUTE_STATUS_LABEL[d.status] ?? d.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {DISPUTE_CATEGORY_LABEL[d.category] ?? d.category} · aberta por{" "}
                      {d.openedByName} contra {d.counterpartName}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
