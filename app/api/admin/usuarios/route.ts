import { NextResponse } from "next/server";
import { lerSessao } from "@/lib/sessao-servidor";
import { buscarUsuarios, banirUsuario, desbanirUsuario } from "@/lib/admin-usuarios";

// Todas as rotas aqui exigem inspetor (admin). O proxy.ts ainda não cobre
// /api/admin/* — a checagem abaixo é a trava de verdade.
async function exigirAdmin() {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false as const, resp: NextResponse.json({ erro: "Faça login." }, { status: 401 }) };
  if (sessao.papel !== "admin") {
    return { ok: false as const, resp: NextResponse.json({ erro: "Só o inspetor." }, { status: 403 }) };
  }
  return { ok: true as const, sessao };
}

/** GET /api/admin/usuarios?q=termo — lista pessoas (busca por nome/apelido/e-mail). */
export async function GET(request: Request) {
  const auth = await exigirAdmin();
  if (!auth.ok) return auth.resp;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const usuarios = await buscarUsuarios(q);
  return NextResponse.json({ usuarios });
}

/** POST /api/admin/usuarios — bane ou desbane.
 *  body: { userId, acao: "banir" | "desbanir", motivo? } */
export async function POST(request: Request) {
  const auth = await exigirAdmin();
  if (!auth.ok) return auth.resp;

  const body = await request.json().catch(() => null);
  const { userId, acao, motivo } = body ?? {};

  if (typeof userId !== "number" || !Number.isFinite(userId)) {
    return NextResponse.json({ erro: "Usuário inválido." }, { status: 400 });
  }
  if (acao !== "banir" && acao !== "desbanir") {
    return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
  }

  const resultado =
    acao === "banir"
      ? await banirUsuario(userId, typeof motivo === "string" ? motivo : "")
      : await desbanirUsuario(userId);

  if (!resultado.ok) {
    return NextResponse.json({ erro: resultado.erro }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
