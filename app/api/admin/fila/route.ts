import { NextResponse } from "next/server";
import { moverNaFila, type Movimento } from "@/lib/painel-db";
import { lerSessao } from "@/lib/sessao-servidor";

/** Mexer na fila muda a ordem em que TODO editor recebe missão. Fica só com
 *  o inspetor — a checagem é aqui, não na tela, porque a tela é só desenho. */
export async function POST(request: Request) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  if (sessao.papel !== "admin") {
    return NextResponse.json({ erro: "Só o inspetor." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = body?.id;
  const movimento = body?.movimento as Movimento;

  if (typeof id !== "number" || !Number.isFinite(id)) {
    return NextResponse.json({ erro: "Missão inválida." }, { status: 400 });
  }
  if (movimento !== "subir" && movimento !== "descer" && movimento !== "topo") {
    return NextResponse.json({ erro: "Movimento inválido." }, { status: 400 });
  }

  const r = await moverNaFila(id, movimento);
  if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 400 });

  return NextResponse.json({ ok: true });
}
