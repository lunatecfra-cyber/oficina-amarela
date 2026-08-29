import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { MusicLibrary } from "@/components/music-library";
import { requireSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Músicas — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function MusicPage() {
  await requireSession();

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-5 py-8 lg:px-8 lg:py-12">
          <MusicLibrary />
        </div>
      </main>
    </>
  );
}
