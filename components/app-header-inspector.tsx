import Link from "next/link";
import { InspectorNav } from "@/components/inspector-nav";
import { LocalGuide } from "@/components/local-guide";
import { Logo } from "@/components/logo";
import { readSession } from "@/lib/server-session";

export async function AppHeaderInspector() {
  const session = await readSession();
  if (session?.role !== "admin") return null;

  return (
    <header className="border-b border-line-soft">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <Link href="/inspetor" className="flex items-center gap-3">
          <Logo size="normal" />
          <span className="hidden font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.24em] text-gold sm:inline">
            OFICINA AMARELA
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <LocalGuide />
          <span className="hidden text-sm text-muted sm:block">
            {session.name} · controle de qualidade
          </span>
          <Link
            href="/"
            className="text-xs uppercase tracking-[0.12em] text-muted transition-colors hover:text-silver-hi"
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

export { AppHeaderInspector as AppHeaderInspetor };
