import { NextResponse } from "next/server";
import { viewUserDetail } from "@/lib/admin-users";
import { readSession } from "@/lib/server-session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session)
    return NextResponse.json({ error: "Faça login.", erro: "Faça login." }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Só o inspetor.", erro: "Só o inspetor." }, { status: 403 });
  }

  const { id } = await context.params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) {
    return NextResponse.json(
      { error: "ID de usuário inválido.", erro: "ID inválido." },
      { status: 400 },
    );
  }

  const detail = await viewUserDetail(userId);
  if (!detail)
    return NextResponse.json(
      { error: "Conta não encontrada.", erro: "Não encontrada." },
      { status: 404 },
    );

  return NextResponse.json({ user: detail, usuario: detail });
}
