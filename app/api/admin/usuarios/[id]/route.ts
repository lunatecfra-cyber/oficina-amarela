import { NextResponse } from "next/server";
import { lerSessao } from "@/lib/sessao-servidor";
import { verDetalhesUsuario } from "@/lib/admin-usuarios";

/** GET /api/admin/usuarios/[id] — perfil completo de uma pessoa. */
export async function GET(
  _request: Request,
  contexto: { params: Promise<{ id: string }> }
) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  if (sessao.papel !== "admin") {
    return NextResponse.json({ erro: "Só o inspetor." }, { status: 403 });
  }

  const { id } = await contexto.params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ erro: "ID inválido." }, { status: 400 });
  }

  const detalhe = await verDetalhesUsuario(userId);
  if (!detalhe) return NextResponse.json({ erro: "Conta não encontrada." }, { status: 404 });

  return NextResponse.json({ usuario: detalhe });
}
