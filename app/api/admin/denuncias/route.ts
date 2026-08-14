import { NextResponse } from "next/server";
import { lerSessao } from "@/lib/sessao-servidor";
import { resolverDenuncia } from "@/lib/denuncias-db";

/** POST /api/admin/denuncias — inspetor fecha uma denúncia.
 *  body: { denunciaId, acao: "resolver" | "ignorar" } */
export async function POST(request: Request) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  if (sessao.papel !== "admin") {
    return NextResponse.json({ erro: "Só o inspetor." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { denunciaId, acao } = body ?? {};

  if (typeof denunciaId !== "number" || !Number.isFinite(denunciaId)) {
    return NextResponse.json({ erro: "Denúncia inválida." }, { status: 400 });
  }
  if (acao !== "resolver" && acao !== "ignorar") {
    return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
  }

  const resultado = await resolverDenuncia(denunciaId, acao);
  if (!resultado.ok) {
    return NextResponse.json({ erro: resultado.erro }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
