import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  autenticar,
  limparTentativasLogin,
  loginTravado,
  loginTravadoPorIp,
  registrarFalhaLogin,
  registrarFalhaLoginIp,
} from "@/lib/contas";
import { ipDaRequisicao } from "@/lib/ip";
import { criarTokenSessao, NOME_COOKIE, COOKIE_OPTS } from "@/lib/sessao";
import { registrarEntradaDiaria } from "@/lib/gamificacao-db";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { apelido, senha } = body ?? {};

  if (typeof apelido !== "string" || typeof senha !== "string") {
    return NextResponse.json({ erro: "Preencha apelido e senha." }, { status: 400 });
  }

  const ip = ipDaRequisicao(request);

  // duas travas somadas: a do apelido protege uma conta de ser martelada; a do
  // IP protege TODAS as contas de serem varridas com uma senha só, que é o
  // ataque que passava batido por só existir a primeira
  const trava = await loginTravado(apelido);
  const travaIp = await loginTravadoPorIp(ip);
  if (trava.travado || travaIp.travado) {
    const minutos = Math.max(trava.minutos, travaIp.minutos);
    return NextResponse.json(
      { erro: `Muitas tentativas. Tenta de novo em ${minutos} min.` },
      { status: 429 }
    );
  }

  const resultado = await autenticar(apelido, senha);
  if (!resultado.ok) {
    await registrarFalhaLogin(apelido);
    await registrarFalhaLoginIp(ip);
    return NextResponse.json({ erro: resultado.erro }, { status: 401 });
  }

  await limparTentativasLogin(apelido);

  const token = await criarTokenSessao(resultado.conta);
  const jar = await cookies();
  jar.set(NOME_COOKIE, token, COOKIE_OPTS);
  void registrarEntradaDiaria(resultado.conta.id).catch((e) =>
    console.error("[gamificacao] falhou ao registrar entrada", e)
  );

  return NextResponse.json({ ok: true, ...resultado.conta });
}
