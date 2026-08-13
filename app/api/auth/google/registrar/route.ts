import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { criarContaGoogle } from "@/lib/contas";
import {
  COOKIE_OPTS,
  criarTokenSessao,
  NOME_COOKIE,
  NOME_COOKIE_PENDENTE,
  verificarIdentidadePendente,
} from "@/lib/sessao";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const papel = body?.papel;

  if (papel !== "editor" && papel !== "voz") {
    return NextResponse.json({ erro: "Escolhe se você é editor ou porta-voz." }, { status: 400 });
  }

  // a identidade vem do cookie, nunca do corpo: quem manda a requisição escolhe
  // só o papel. Antes o token vinha no corpo, e ele tinha chegado ali pela
  // query string — quem o interceptasse criava a conta no lugar da pessoa.
  const jar = await cookies();
  const token = jar.get(NOME_COOKIE_PENDENTE)?.value;
  const pendente = token ? await verificarIdentidadePendente(token) : null;
  if (!pendente) {
    return NextResponse.json({ erro: "Sessão expirou, tenta de novo." }, { status: 400 });
  }

  const resultado = await criarContaGoogle({ ...pendente, papel });
  if (!resultado.ok) {
    return NextResponse.json({ erro: resultado.erro }, { status: 400 });
  }

  // conta criada: o token pendente não serve mais pra nada
  jar.delete(NOME_COOKIE_PENDENTE);

  const sessaoToken = await criarTokenSessao(resultado.conta);
  jar.set(NOME_COOKIE, sessaoToken, COOKIE_OPTS);

  const destino = papel === "editor" ? "/editor/criar-perfil" : "/porta-voz/criar-perfil?via=google";
  return NextResponse.json({ ok: true, destino });
}
