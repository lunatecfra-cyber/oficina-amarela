import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apagarConta } from "@/lib/contas";
import { NOME_COOKIE } from "@/lib/sessao";
import { lerSessao } from "@/lib/sessao-servidor";

// Direito do titular (LGPD art. 18) — a política em /privacidade promete
// isso desde sempre e não existia nada por trás.
//
// Sempre a conta da PRÓPRIA sessão: o id nunca vem do corpo da requisição.
// Assim não existe o parâmetro que alguém trocaria pra apagar a conta alheia.
export async function DELETE(request: Request) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const confirmacao = body?.confirmacao;

  if (typeof confirmacao !== "string" || !confirmacao) {
    return NextResponse.json(
      { erro: "Confirme antes de apagar." },
      { status: 400 }
    );
  }

  const r = await apagarConta(sessao.id, confirmacao);
  if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 403 });

  // a conta sumiu do banco, mas o cookie continuaria no navegador apontando
  // pra um id que não existe mais
  const jar = await cookies();
  jar.delete(NOME_COOKIE);

  return NextResponse.json({ ok: true });
}
