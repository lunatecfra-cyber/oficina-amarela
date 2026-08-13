import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { criarContaGoogle } from "@/lib/contas";
import { criarTokenSessao, verificarIdentidadePendente, NOME_COOKIE, COOKIE_OPTS } from "@/lib/sessao";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = body?.token;
  const papel = body?.papel;

  if (typeof token !== "string") {
    return NextResponse.json({ erro: "Sessão expirou, tenta de novo." }, { status: 400 });
  }
  if (papel !== "editor" && papel !== "voz") {
    return NextResponse.json({ erro: "Escolhe se você é editor ou porta-voz." }, { status: 400 });
  }

  const pendente = await verificarIdentidadePendente(token);
  if (!pendente) {
    return NextResponse.json({ erro: "Sessão expirou, tenta de novo." }, { status: 400 });
  }

  const resultado = await criarContaGoogle({ ...pendente, papel });
  if (!resultado.ok) {
    return NextResponse.json({ erro: resultado.erro }, { status: 400 });
  }

  const sessaoToken = await criarTokenSessao(resultado.conta);
  const jar = await cookies();
  jar.set(NOME_COOKIE, sessaoToken, COOKIE_OPTS);

  const destino = papel === "editor" ? "/editor/criar-perfil" : "/porta-voz/criar-perfil?via=google";
  return NextResponse.json({ ok: true, destino });
}
