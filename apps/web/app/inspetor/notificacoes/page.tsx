import type { Metadata } from "next";
import Link from "next/link";
import { getAdminNotifications } from "@/lib/overview-db";

export const metadata: Metadata = { title: "Alertas — Oficina Amarela" };
export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, { txt: string; cls: string }> = {
  queue_stalled: { txt: "fila parada", cls: "border-gold-lo/50 bg-gold-lo/10 text-gold-hi" },
  editing_stalled: { txt: "edição parada", cls: "border-danger/40 bg-danger/10 text-danger" },
  awaiting_review: {
    txt: "esperando revisão",
    cls: "border-silver-hi/40 bg-silver-hi/10 text-silver-hi",
  },
  report_open: { txt: "denúncia aberta", cls: "border-danger/40 bg-danger/10 text-danger" },
};

function shortDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function NotificationsPage() {
  const notifications = await getAdminNotifications();

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
            Alertas
          </h1>
          <p className="mt-1 text-sm text-muted">O que está parado ou esperando uma decisão sua.</p>
        </div>
        <p className="text-sm text-muted">
          {notifications.length} pendente{notifications.length === 1 ? "" : "s"}
        </p>
      </div>

      {notifications.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line-soft bg-surface/40 p-10 text-center text-sm text-muted">
          Nada pendente agora. Tudo em ordem.
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {notifications.map((n) => {
            const label = CATEGORY_LABELS[n.category] ?? { txt: n.category, cls: "border-line" };
            return (
              <li key={n.id} className="rounded-2xl border border-line bg-surface/70 p-4 lg:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${label.cls}`}
                  >
                    {label.txt}
                  </span>
                  <span className="text-xs text-muted-2">{shortDate(n.since)}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-text">{n.title}</p>
                <p className="mt-1 text-xs text-muted">{n.description}</p>
                <Link
                  href={n.href}
                  className="mt-3 inline-block text-xs font-medium text-gold-hi hover:underline"
                >
                  Resolver agora →
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
