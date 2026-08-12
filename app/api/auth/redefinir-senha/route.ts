import { NextResponse } from "next/server";
import { atualizarSenha, linkRecuperacaoJaUsado } from "@/lib/contas";
import { verificarTokenRecuperacao } from "@/lib/sessao";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { token, senha } = body ?? {};

  if (typeof token !== "string" || typeof senha !== "string") {
    return NextResponse.json({ erro: "Preencha a nova senha." }, { status: 400 });
  }

  const dados = await verificarTokenRecuperacao(token);
  if (!dados) {
    return NextResponse.json({ erro: "Link expirado ou inválido. Peça um novo." }, { status: 401 });
  }

  // link de uso único: assinatura válida não basta, ele não pode já ter sido
  // gasto. Mesma resposta do token inválido — quem tem o link na mão não
  // precisa saber se ele foi usado ou se nunca prestou.
  if (await linkRecuperacaoJaUsado(dados.userId, dados.emitidoEmMs)) {
    return NextResponse.json({ erro: "Link expirado ou inválido. Peça um novo." }, { status: 401 });
  }

  const resultado = await atualizarSenha(dados.userId, senha);
  if (!resultado.ok) {
    return NextResponse.json({ erro: resultado.erro }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
