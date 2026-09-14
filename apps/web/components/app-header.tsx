import type { Editor } from "@oficina/domain/missions";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { EditorNav } from "@/components/editor-nav";
import { LocalGuide } from "@/components/local-guide";
import { LogoutButton } from "@/components/logout-button";
import { readEditorProfile } from "@/lib/profile-db";
import { getSession } from "@/lib/server-session";

export async function AppHeader() {
  const session = await getSession();
  const profile = session ? await readEditorProfile(session.id) : null;

  if (!session) {
    return (
      <header className="border-b border-line-soft">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link href="/" className="flex min-h-11 flex-none items-center gap-2.5 lg:gap-3">
            <BrandMark />
          </Link>

          <Link href="/login" className="tap-target text-sm text-muted hover:text-gold-hi">
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
          <Link href="/editor" className="flex min-h-11 flex-none items-center gap-2.5 lg:gap-3">
            <BrandMark />
          </Link>

        </div>

        <div className="flex flex-none items-center gap-2 sm:gap-4">

          <Link
            href="/perfil"
            className="hidden min-w-0 max-w-48 text-right transition-opacity hover:opacity-80 sm:block"
          >
            <p className="truncate text-sm font-medium text-text" title={editor.handle}>{editor.handle}</p>
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

      <div className="border-t border-line-soft">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-1 sm:px-5 lg:px-8">
          <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <EditorNav />
          </div>
          <div className="flex-none border-l border-line-soft pl-3">
            <LocalGuide />
          </div>
        </div>
      </div>
    </header>
  );
}
