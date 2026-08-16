import { NextResponse } from "next/server";
import { apagarPauta } from "@/lib/pautas-db";
import { lerSessao } from "@/lib/sessao-servidor";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  if (sessao.papel !== "admin") {
    return NextResponse.json({ erro: "Só o inspetor." }, { status: 403 });
  }

  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ erro: "Missão inválida." }, { status: 400 });
  }

  const r = await apagarPauta(id);
  if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 404 });

  return NextResponse.json({ ok: true });
}
