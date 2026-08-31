import type { Editor } from "@oficina/domain/missions";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { EditorNav } from "@/components/editor-nav";
import { LocalGuide } from "@/components/local-guide";
import { LogoutButton } from "@/components/logout-button";
import { readEditorProfile } from "@/lib/profile-db";
import { readSession } from "@/lib/server-session";

export async function AppHeader() {
  const session = await readSession();
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

          <div className="hidden sm:block">
            <EditorNav />
          </div>
        </div>

        <div className="flex flex-none items-center gap-2 sm:gap-4">
          <LocalGuide />

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

      {/* Segunda linha, só no celular: a navegação com espaço pra respirar.
          O padding lateral acompanha o da linha de cima (px-4) — com px-2 as
          abas começavam 8px antes da logo e o cabeçalho lia torto. */}
      <div className="border-t border-line-soft px-4 pb-1 sm:hidden">
        <EditorNav />
      </div>
    </header>
  );
}
