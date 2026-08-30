import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createNewsArticle, deleteNewsArticle, toggleNewsPublication } from "@/lib/news-db";
import { readSession } from "@/lib/server-session";

function refreshHomepageCache() {
  revalidatePath("/");
}

async function requireAdmin() {
  const session = await readSession();
  if (!session) {
    return {
      ok: false as const,
      resp: NextResponse.json({ error: "Faça login.", erro: "Faça login." }, { status: 401 }),
    };
  }
  if (session.role !== "admin") {
    return {
      ok: false as const,
      resp: NextResponse.json({ error: "Só o inspetor.", erro: "Só o inspetor." }, { status: 403 }),
    };
  }
  return { ok: true as const, session };
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.resp;

  const body = await request.json().catch(() => null);
  const rawAction = body?.action ?? body?.acao;
  const action =
    rawAction === "create" || rawAction === "criar"
      ? "create"
      : rawAction === "toggle" || rawAction === "alternar"
        ? "toggle"
        : rawAction === "delete" || rawAction === "apagar"
          ? "delete"
          : null;

  if (action === "create") {
    const title = String(body?.title ?? body?.titulo ?? "");
    const text = String(body?.text ?? body?.texto ?? "");
    const result = await createNewsArticle(auth.session.id, title, text);
    if (!result.ok)
      return NextResponse.json({ error: result.error, erro: result.error }, { status: 400 });
    refreshHomepageCache();
    return NextResponse.json({ ok: true, id: result.id });
  }

  const id = body?.id;
  if (typeof id !== "number" || !Number.isFinite(id)) {
    return NextResponse.json(
      { error: "Identificador de novidade inválido.", erro: "Identificador inválido." },
      { status: 400 },
    );
  }

  if (action === "toggle") {
    const result = await toggleNewsPublication(id);
    if (!result.ok)
      return NextResponse.json({ error: result.error, erro: result.error }, { status: 400 });
    refreshHomepageCache();
    return NextResponse.json({
      ok: true,
      published: result.published,
      publicada: result.published,
    });
  }

  if (action === "delete") {
    const result = await deleteNewsArticle(id);
    if (!result.ok)
      return NextResponse.json({ error: result.error, erro: result.error }, { status: 400 });
    refreshHomepageCache();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação inválida.", erro: "Ação inválida." }, { status: 400 });
}
