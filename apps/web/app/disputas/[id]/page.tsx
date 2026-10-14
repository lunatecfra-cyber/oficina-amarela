import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { DisputeActions } from "@/components/dispute-forms";
import {
  DISPUTE_CATEGORY_LABEL,
  DISPUTE_OUTCOME_LABEL,
  DISPUTE_STATUS_LABEL,
  getDispute,
} from "@/lib/disputes-db";
import { requireSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Disputa — Oficina Amarela" };
export const dynamic = "force-dynamic";

const when = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default async function DisputePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const id = Number((await params).id);
  const dispute = Number.isInteger(id) && id > 0 ? await getDispute(id) : null;
  if (!dispute) notFound();

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-8 lg:py-12">
          <p className="text-xs text-muted">
            {DISPUTE_STATUS_LABEL[dispute.status]} ·{" "}
            {DISPUTE_CATEGORY_LABEL[dispute.category] ?? dispute.category}
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text">
            Disputa sobre “{dispute.missionTitle}”
          </h1>
          <p className="mt-1 text-sm text-muted">
            Aberta por {dispute.openedByName} contra {dispute.counterpartName} em{" "}
            {when(dispute.createdAt)}.
          </p>
          <p className="mt-4 whitespace-pre-line rounded-xl border border-line bg-surface/70 px-4 py-3 text-sm text-text/90">
            {dispute.claim}
          </p>

          <section className="mt-8" aria-label="Manifestações">
            <h2 className="text-lg font-semibold text-text">Manifestações</h2>
            {dispute.statements.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Ninguém se manifestou ainda.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {dispute.statements.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-xl border border-line bg-ink-2/50 px-3.5 py-2.5"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-medium text-text">{s.authorName}</span>
                      <span className="text-[11px] uppercase tracking-wider text-muted">
                        {s.authorKind === "mediator" ? "Mediação" : "Parte"}
                      </span>
                      <span className="ml-auto text-[11px] text-muted-2">{when(s.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-line break-words text-sm text-text/90">
                      {s.body}
                    </p>
                    {s.attachments.map((a) => (
                      <a
                        key={a.id}
                        href={`/api/disputes/${dispute.id}/attachments/${a.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-xs text-gold-hi underline underline-offset-2"
                      >
                        {a.filename}
                      </a>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {dispute.decisions.length > 0 && (
            <section className="mt-8" aria-label="Decisões">
              <h2 className="text-lg font-semibold text-text">Decisões</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {dispute.decisions.map((d) => (
                  <li
                    key={d.round}
                    className="rounded-xl border border-gold-lo/50 bg-gold/[0.06] px-4 py-3"
                  >
                    <p className="text-sm font-medium text-text">
                      {d.round === 1 ? "Decisão da mediação" : "Decisão do recurso"}:{" "}
                      {DISPUTE_OUTCOME_LABEL[d.outcome]}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm text-text/90">{d.rationale}</p>
                    {d.recommendation && (
                      <p className="mt-1 text-sm text-muted">Recomendação: {d.recommendation}</p>
                    )}
                    <p className="mt-1 text-[11px] text-muted-2">
                      {d.deciderName} · {when(d.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">
                A decisão fica registrada e não altera valores, reputação ou o estado da missão por
                conta própria.
              </p>
            </section>
          )}

          {dispute.appeal && (
            <section className="mt-8" aria-label="Recurso">
              <h2 className="text-lg font-semibold text-text">Recurso</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-text/90">
                {dispute.appeal.reason}
              </p>
              <p className="mt-1 text-[11px] text-muted-2">{when(dispute.appeal.createdAt)}</p>
            </section>
          )}

          {dispute.closeReason && (
            <p className="mt-6 text-sm text-muted">Encerrada: {dispute.closeReason}</p>
          )}

          <DisputeActions id={dispute.id} can={dispute.can} />
        </div>
      </main>
    </>
  );
}
