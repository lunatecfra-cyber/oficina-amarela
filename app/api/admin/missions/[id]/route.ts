import { NextResponse } from "next/server";
import { deleteMissionPermanently } from "@/lib/missions-db";
import { readSession } from "@/lib/server-session";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Faça login.", erro: "Faça login." }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Só o inspetor.", erro: "Só o inspetor." }, { status: 403 });
  }

  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "Identificador de missão inválido.", erro: "Missão inválida." }, { status: 400 });
  }

  const result = await deleteMissionPermanently(id);
  if (!result.ok) return NextResponse.json({ error: result.error, erro: result.error }, { status: 404 });

  return NextResponse.json({ ok: true });
}
