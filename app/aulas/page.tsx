import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { requireSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Aulas — Oficina Amarela" };

export default async function LessonsPage() {
  await requireSession();

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-12">
          <div className="mb-8">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
              Aulas
            </h1>
            <p className="mt-1 text-sm text-muted">
              O que a Oficina ensina pra você editar melhor e entregar mais rápido.
            </p>
          </div>

          <section className="overflow-hidden rounded-2xl border border-line bg-surface/60">
            <div
              className="h-1 w-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(244,206,31,0.6), rgba(244,206,31,0.9), rgba(244,206,31,0.6), transparent)",
              }}
              aria-hidden="true"
            />
            <div className="px-6 py-14 text-center lg:py-20">
              <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-gold-lo/40 bg-gold/[0.06] text-2xl">
                🎓
              </span>
              <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-text">
                Em breve
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
                Está sendo preparado: ritmo de corte, legenda que segura o
                espectador, cor no vídeo político e os erros que mais derrubam
                entrega na conferência.
              </p>
              <p className="mt-6 text-xs text-muted-2">
                Você vai ver por aqui assim que a primeira turma abrir.
              </p>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
