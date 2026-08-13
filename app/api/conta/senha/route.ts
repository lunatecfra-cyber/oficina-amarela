import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { atualizarSenha } from "@/lib/contas";
import { criarTokenSessao, NOME_COOKIE, COOKIE_OPTS } from "@/lib/sessao";
import { lerSessao } from "@/lib/sessao-servidor";

/**
 * Define uma senha nova pra quem já está logado.
 *
 * Não pede a senha atual, e isso é de propósito: quem mais precisa desta tela é
 * exatamente quem esqueceu a senha e voltou pela conta Google. Exigir a antiga
 * fecharia a porta na cara de quem ela existe pra atender.
 *
 * O que segura o abuso é o efeito colateral de `atualizarSenha`: trocar a senha
 * marca `sessoes_validas_apos = now()` e derruba TODA sessão emitida antes —
 * então alguém que tivesse pegado uma sessão aberta e trocasse a senha se
 * denunciaria na hora, porque a pessoa cai pra fora. E o cookie novo abaixo é o
 * que evita deslogar quem acabou de trocar a própria senha.
 */
export async function POST(request: Request) {
  const sessao = await lerSessao();
  if (!sessao) {
    return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const novaSenha = body?.novaSenha;

  if (typeof novaSenha !== "string") {
    return NextResponse.json({ erro: "Digite a senha nova." }, { status: 400 });
  }
  if (novaSenha.length > 200) {
    return NextResponse.json({ erro: "Senha longa demais." }, { status: 400 });
  }

  const r = await atualizarSenha(sessao.id, novaSenha);
  if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 400 });

  // o corte acabou de invalidar a sessão que fez esta requisição; um token novo
  // mantém quem trocou a senha logado, e só as outras sessões caem
  const token = await criarTokenSessao(sessao);
  const jar = await cookies();
  jar.set(NOME_COOKIE, token, COOKIE_OPTS);

  return NextResponse.json({ ok: true });
}
