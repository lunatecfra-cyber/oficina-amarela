import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { requireSession } from "@/lib/server-session";
import { ToolsList } from "@/components/tools-list";
import { GUILD_DRIVE } from "@/lib/tools";

export const metadata: Metadata = { title: "Ferramentas — Oficina Amarela" };

export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  await requireSession();

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-5 py-6 lg:px-8 lg:py-10">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
            Ferramentas
          </h1>
          <p className="mt-1 text-sm text-muted">
            O que abrir quando trava no meio de um corte.
          </p>

          <div className="mt-6">
            <ToolsList />
          </div>

          {/* O repertório próprio da guilda fecha a página: é o único acervo
              nosso, e fica no fim pra não competir com a busca. */}
          <section className="mt-10 rounded-2xl border border-gold-lo/40 bg-gold/[0.05] p-5">
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-text">
              Repertório da guilda
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              A pasta com o que já foi separado aqui dentro: trilhas, efeitos e
              material de apoio.
            </p>
            <a
              href={GUILD_DRIVE}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold mt-4 sm:w-56"
            >
              Abrir o Drive
            </a>
            <p className="mt-3 text-xs leading-relaxed text-muted-2">
              As pastas separadas de músicas, áudios e referências ainda estão
              por montar — quando existirem, entram na lista acima.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
