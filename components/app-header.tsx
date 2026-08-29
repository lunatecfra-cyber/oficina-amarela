import Link from "next/link";
import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import { EditorNav } from "@/components/editor-nav";
import { LocalGuide } from "@/components/local-guide";
import type { Editor } from "@/lib/missions";
import { readEditorProfile } from "@/lib/profile-db";
import { readSession } from "@/lib/server-session";

export async function AppHeader() {
  const session = await readSession();
  const profile = session ? await readEditorProfile(session.id) : null;

  if (!session) {
    return (
      <header className="border-b border-line-soft">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Logo size="normal" />
            <span className="hidden font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.24em] text-gold sm:inline">
              OFICINA AMARELA
            </span>
          </Link>

          <Link
            href="/login"
            className="text-sm text-muted transition-colors hover:text-gold-hi"
          >
            Entrar
          </Link>
        </div>
      </header>
    );
  }

  const delivered = profile ? (profile.deliveredCount ?? profile.deliveries ?? 0) : 0;
  const tier = profile ? (profile.tier ?? profile.level ?? "Aprendiz") : "Aprendiz";
  const rating = profile ? profile.rating : null;
  const editor: Editor = {
    handle: profile?.handle ?? session.handle,
    apelido: profile?.handle ?? session.handle,
    level: tier as Editor["level"],
    nivel: tier as Editor["level"],
    deliveredCount: delivered,
    entregues: delivered,
    rating: rating,
    nota: rating,
  };

  return (
    <header className="border-b border-line-soft">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/editor" className="flex flex-none items-center gap-3">
            <Logo size="normal" />
            <span className="hidden font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.24em] text-gold sm:inline">
              OFICINA AMARELA
            </span>
          </Link>

          <div className="hidden sm:block">
            <EditorNav />
          </div>
        </div>

        <div className="flex flex-none items-center gap-2 sm:gap-4">
          <LocalGuide />

          {session.role === "admin" && (
            <Link
              href="/inspetor"
              className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-gold-lo/60 hover:text-gold-hi"
            >
              Inspetor
            </Link>
          )}

          <Link
            href="/perfil"
            className="hidden text-right transition-opacity hover:opacity-80 sm:block"
          >
            <p className="text-sm font-medium text-text">{editor.handle}</p>
            <p className="text-xs text-muted">
              {editor.deliveredCount} entregues
              {editor.rating !== null && ` · nota ${editor.rating}`}
            </p>
          </Link>

          <Link
            href="/perfil"
            className="flex min-h-11 flex-none items-center rounded-full border border-gold-lo/60 bg-gold/10 px-3 text-xs font-medium text-gold-hi transition-colors hover:bg-gold/20"
          >
            {editor.level}
          </Link>

          <LogoutButton className="flex min-h-11 flex-none items-center px-1 text-xs uppercase tracking-[0.12em] text-muted transition-colors hover:text-silver-hi" />
        </div>
      </div>

      <div className="border-t border-line-soft px-2 pb-1 sm:hidden">
        <EditorNav />
      </div>
    </header>
  );
}
