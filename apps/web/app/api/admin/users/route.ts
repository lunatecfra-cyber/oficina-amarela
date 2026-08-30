import { NextResponse } from "next/server";
import { banUser, removeUser, searchUsers, unbanUser } from "@/lib/admin-users";
import { readSession } from "@/lib/server-session";

async function requireAdmin() {
  const session = await readSession();
  if (!session)
    return {
      ok: false as const,
      resp: NextResponse.json({ error: "Faça login.", erro: "Faça login." }, { status: 401 }),
    };
  if (session.role !== "admin") {
    return {
      ok: false as const,
      resp: NextResponse.json({ error: "Só o inspetor.", erro: "Só o inspetor." }, { status: 403 }),
    };
  }
  return { ok: true as const, session };
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.resp;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const users = await searchUsers(q);
  return NextResponse.json({ users, usuarios: users });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.resp;

  const body = await request.json().catch(() => null);
  const userId = body?.userId;
  const rawAction = body?.action ?? body?.acao;
  const reason = body?.reason ?? body?.motivo;

  const action =
    rawAction === "ban" || rawAction === "banir"
      ? "ban"
      : rawAction === "unban" || rawAction === "desbanir"
        ? "unban"
        : rawAction === "delete" || rawAction === "apagar"
          ? "delete"
          : null;

  if (typeof userId !== "number" || !Number.isFinite(userId)) {
    return NextResponse.json(
      { error: "Identificador de usuário inválido.", erro: "Usuário inválido." },
      { status: 400 },
    );
  }
  if (!action) {
    return NextResponse.json({ error: "Ação inválida.", erro: "Ação inválida." }, { status: 400 });
  }

  if (action === "delete" && userId === auth.session.id) {
    return NextResponse.json(
      { error: "Para apagar a sua própria conta, use a tela de perfil.", erro: "Auto exclusão." },
      { status: 400 },
    );
  }

  const result =
    action === "ban"
      ? await banUser(userId, typeof reason === "string" ? reason : "")
      : action === "unban"
        ? await unbanUser(userId)
        : await removeUser(userId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error, erro: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
