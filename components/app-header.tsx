import Link from "next/link";
import { Logo } from "@/components/logo";
import { BotaoSair } from "@/components/botao-sair";
import { NavEditor } from "@/components/nav-editor";
import { EDITOR_ATUAL, type Editor } from "@/lib/pautas";
import { lerPerfilEditor } from "@/lib/perfil-db";
import { lerSessao } from "@/lib/sessao-servidor";

export async function AppHeader() {
  const sessao = await lerSessao();
  const perfil = sessao ? await lerPerfilEditor(sessao.id) : null;

  // números reais da conta. EDITOR_ATUAL só entra se não houver sessão —
  // antes ele aparecia sempre, e uma conta nova exibia "12 entregues · 4.8"
  const editor: Editor = perfil
    ? {
        apelido: perfil.apelido,
        nivel: (perfil.nivel ?? "Aprendiz") as Editor["nivel"],
        entregues: perfil.entregues,
        nota: perfil.nota,
      }
    : EDITOR_ATUAL;
  return (
    <header className="border-b border-line-soft">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/editor" className="flex items-center gap-3">
            <Logo className="w-9" />
            <span className="hidden font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.24em] text-gold sm:inline">
              OFICINA AMARELA
            </span>
          </Link>

          <NavEditor />
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/perfil"
            className="hidden text-right transition-opacity hover:opacity-80 sm:block"
          >
            <p className="text-sm font-medium text-text">{editor.apelido}</p>
            <p className="text-xs text-muted">
              {editor.entregues} entregues
              {editor.nota !== null && ` · nota ${editor.nota}`}
            </p>
          </Link>

          <Link
            href="/perfil"
            className="rounded-full border border-gold-lo/60 bg-gold/10 px-3 py-1 text-xs font-medium text-gold-hi transition-colors hover:bg-gold/20"
          >
            {editor.nivel}
          </Link>

          <BotaoSair className="text-xs uppercase tracking-[0.12em] text-muted transition-colors hover:text-silver-hi" />
        </div>
      </div>
    </header>
  );
}
