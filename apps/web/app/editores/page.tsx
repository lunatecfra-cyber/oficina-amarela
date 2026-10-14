import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { EditorDirectory } from "@/components/editor-directory";
import { getSpokespersonMissions } from "@/lib/missions-db";
import { requireSession } from "@/lib/server-session";
export const dynamic = "force-dynamic";
export default async function EditorsPage() {
  const session = await requireSession();
  const missions = session.role === "spokesperson" ? await getSpokespersonMissions(session.id) : [];
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl p-5 lg:p-8">
        <Link
          className="tap-target -ml-3 mb-2 text-sm text-gold-hi"
          href={
            session.role === "spokesperson"
              ? "/porta-voz"
              : session.role === "admin" || session.role === "inspector"
                ? "/inspetor"
                : "/editor"
          }
        >
          Voltar à minha área
        </Link>
        {session.role === "spokesperson" && (
          <Link className="btn-ghost mb-4" href="/porta-voz/nova-pauta">
            Criar missão
          </Link>
        )}
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
          Diretório de editores
        </h1>
        <p className="mt-2 text-sm text-muted">
          Conheça os perfis publicados pelos editores. Avaliações refletem entregas reais; escolha e
          convite continuam sob sua responsabilidade.
        </p>
        <EditorDirectory
          missions={missions
            .filter(
              (m) => m.manualSelection && (m.status === "available" || m.status === "disponivel"),
            )
            .map((m) => ({ id: m.id, title: m.title }))}
        />
      </main>
    </>
  );
}
