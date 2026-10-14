import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { LessonPlayer } from "@/components/lesson-player";
import { getLesson } from "@/lib/lessons-db";
import { requireSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Videoaula — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const lesson = /^\d+$/.test(id) ? await getLesson(Number(id)) : null;
  if (!lesson) notFound();

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <LessonPlayer lesson={lesson} />
      </main>
    </>
  );
}
