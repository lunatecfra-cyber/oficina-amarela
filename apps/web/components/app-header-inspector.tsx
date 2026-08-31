import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { InspectorNav } from "@/components/inspector-nav";
import { LocalGuide } from "@/components/local-guide";
import { readSession } from "@/lib/server-session";

export async function AppHeaderInspector() {
  const session = await readSession();
  if (session?.role !== "admin") return null;

  return (
    <header className="border-b border-line-soft">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <Link href="/inspetor" className="flex min-h-11 flex-none items-center gap-2.5 lg:gap-3">
          <BrandMark />
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-4">
          <LocalGuide />
          <span className="hidden text-sm text-muted sm:block">
            {session.name} · controle de qualidade
          </span>
          <Link
            href="/"
            className="tap-target text-xs uppercase tracking-[0.12em] text-muted hover:text-silver-hi"
          >
            Sair
          </Link>
        </div>
      </div>
      <div className="mx-auto w-full max-w-5xl px-5 lg:px-8">
        <InspectorNav />
      </div>
    </header>
  );
}
