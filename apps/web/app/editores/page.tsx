import { EditorDirectory } from "@/components/editor-directory";
import { getSpokespersonMissions } from "@/lib/missions-db";
import { requireSession } from "@/lib/server-session";
export const dynamic = "force-dynamic";
export default async function EditorsPage() {
  const session = await requireSession();
  const missions = session.role === "spokesperson" ? await getSpokespersonMissions(session.id) : [];
  return (
    <main className="mx-auto max-w-4xl p-5 lg:p-8">
      <h1 className="text-2xl font-semibold text-text">Diretório de editores</h1>
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
  );
}
