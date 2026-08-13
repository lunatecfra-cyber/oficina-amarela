import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  autenticar,
  limparTentativasLogin,
  loginTravado,
  registrarFalhaLogin,
} from "@/lib/contas";
import { criarTokenSessao, NOME_COOKIE, COOKIE_OPTS } from "@/lib/sessao";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { apelido, senha } = body ?? {};

  if (typeof apelido !== "string" || typeof senha !== "string") {
    return NextResponse.json({ erro: "Preencha apelido e senha." }, { status: 400 });
  }

  const trava = await loginTravado(apelido);
  if (trava.travado) {
    return NextResponse.json(
      { erro: `Muitas tentativas. Tenta de novo em ${trava.minutos} min.` },
      { status: 429 }
    );
  }

  const resultado = await autenticar(apelido, senha);
  if (!resultado.ok) {
    await registrarFalhaLogin(apelido);
    return NextResponse.json({ erro: resultado.erro }, { status: 401 });
  }

  await limparTentativasLogin(apelido);

  const token = await criarTokenSessao(resultado.conta);
  const jar = await cookies();
  jar.set(NOME_COOKIE, token, COOKIE_OPTS);

  return NextResponse.json({ ok: true, ...resultado.conta });
}
