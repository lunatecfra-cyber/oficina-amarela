import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { LessonsCatalog } from "@/components/lessons-catalog";
import { getLessons } from "@/lib/lessons-db";
import { requireSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Videoaulas — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function LessonsPage() {
  await requireSession();
  const lessons = await getLessons();

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-12">
          <div className="mb-8">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
              Videoaulas
            </h1>
            <p className="mt-1 text-sm text-muted">
              O que a Oficina ensina pra você editar melhor e entregar mais rápido.
            </p>
          </div>
          <LessonsCatalog lessons={lessons} />
        </div>
      </main>
    </>
  );
}
