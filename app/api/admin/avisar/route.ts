import { NextResponse } from "next/server";
import {
  resumoDoSistema,
  emailsDosEditores,
  emailsDosCandidatos,
} from "@/lib/painel-db";
import {
  avisarEditoresFila,
  avisarCandidatosEditoresLivres,
  emailConfigurado,
} from "@/lib/email";
import { lerSessao } from "@/lib/sessao-servidor";

export async function POST(request: Request) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  if (sessao.papel !== "admin") {
    return NextResponse.json({ erro: "Só o inspetor." }, { status: 403 });
  }

  if (!emailConfigurado()) {
    return NextResponse.json(
      { erro: "E-mail não configurado." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const tipo = body?.tipo;
  if (tipo !== "editores" && tipo !== "candidatos") {
    return NextResponse.json({ erro: "Tipo inválido." }, { status: 400 });
  }

  const origem = new URL(request.url).origin;
  const resumo = await resumoDoSistema();

  if (tipo === "editores") {
    if (resumo.naFila === 0) {
      return NextResponse.json({ erro: "Sem missões na fila." }, { status: 400 });
    }
    const lista = await emailsDosEditores();
    for (const p of lista) {
      void avisarEditoresFila(p.email, p.nome, resumo.naFila, `${origem}/editor`);
    }
    return NextResponse.json({ ok: true, enviados: lista.length });
  }

  // tipo === "candidatos"
  if (resumo.editoresLivres === 0) {
    return NextResponse.json({ erro: "Sem editores livres." }, { status: 400 });
  }
  const lista = await emailsDosCandidatos();
  for (const p of lista) {
    void avisarCandidatosEditoresLivres(
      p.email,
      p.nome,
      resumo.editoresLivres,
      `${origem}/porta-voz/nova`
    );
  }
  return NextResponse.json({ ok: true, enviados: lista.length });
}
