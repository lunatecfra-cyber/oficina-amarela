import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { editorLeaderboard } from "@/lib/profile-db";
import { requireSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Ranking — Oficina Amarela" };

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const session = await requireSession();
  const sortedList = await editorLeaderboard();

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-8 lg:py-12">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
            Ranking da guilda
          </h1>
          <p className="mt-1 text-sm text-muted">
            Ordenado por XP (reputação). Constância vale mais que um pico isolado.
          </p>

          {sortedList.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-line p-12 text-center">
              <p className="text-muted">
                Ninguém no ranking ainda. Ele se preenche conforme os editores
                completam o perfil e entregam.
              </p>
              <Link
                href="/editor"
                className="mt-4 inline-block font-medium text-gold-hi hover:underline"
              >
                Ir pra fila de missões
              </Link>
            </div>
          ) : (
            <ol className="mt-6 flex flex-col gap-2">
              {sortedList.map((e, i) => {
                const isMe = e.id === session.id;
                const pos = i + 1;
                return (
                  <li
                    key={e.handle}
                    className={`flex items-center gap-4 rounded-xl border p-4 ${
                      isMe
                        ? "border-gold-lo/60 bg-gold/[0.07]"
                        : "border-line bg-surface/60"
                    }`}
                  >
                    <span
                      className={`grid h-9 w-9 flex-none place-items-center rounded-lg font-[family-name:var(--font-display)] text-base font-semibold ${
                        pos === 1
                          ? "bg-gradient-to-b from-gold to-gold-lo text-black/80"
                          : "border border-line bg-ink-2 text-muted"
                      }`}
                    >
                      {pos}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-text">
                        {isMe ? "Você" : `@${e.handle}`}
                      </p>
                      <p className="text-xs text-muted-2">
                        {e.level} · {e.deliveredCount}{" "}
                        {e.deliveredCount === 1 ? "entregue" : "entregues"}
                        {e.streak > 0 && (
                          <>
                            {" "}
                            · <span aria-hidden="true">🔥</span> {e.streak}
                          </>
                        )}
                      </p>
                    </div>

                    <span className="flex-none font-[family-name:var(--font-display)] text-lg font-semibold text-gold-hi">
                      {e.reputation} XP
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </main>
    </>
  );
}
