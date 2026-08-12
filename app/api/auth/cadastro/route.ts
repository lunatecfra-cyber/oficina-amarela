import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { criarConta, registrarTentativa, taxaTravada } from "@/lib/contas";
import { ipDaRequisicao } from "@/lib/ip";
import { criarTokenSessao, NOME_COOKIE } from "@/lib/sessao";

// Quantas contas o mesmo IP pode criar antes de esfriar. Mais folgado que o
// login (5) porque família e escritório saem pelo mesmo IP.
const MAX_CADASTROS_POR_IP = 10;

export async function POST(request: Request) {
  // freio de criação em massa. Vem antes de ler o corpo pra não gastar
  // trabalho com quem já está travado.
  const chave = `cadastro:${ipDaRequisicao(request)}`;
  const trava = await taxaTravada(chave);
  if (trava.travado) {
    return NextResponse.json(
      { erro: `Muitas contas criadas daqui. Tente em ${trava.minutos} min.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const { nome, apelido, email, senha, papel } = body ?? {};

  if (
    typeof nome !== "string" ||
    typeof apelido !== "string" ||
    typeof email !== "string" ||
    typeof senha !== "string"
  ) {
    return NextResponse.json({ erro: "Preencha todos os campos." }, { status: 400 });
  }
  if (papel !== "voz" && papel !== "editor") {
    return NextResponse.json({ erro: "Escolha se você é porta-voz ou editor." }, { status: 400 });
  }

  // conta a tentativa antes de saber se deu certo: quem varre apelidos pra
  // descobrir quais já existem também precisa ser freado
  await registrarTentativa(chave, MAX_CADASTROS_POR_IP);

  const resultado = await criarConta({ nome, apelido, email, senha, papel });
  if (!resultado.ok) {
    return NextResponse.json({ erro: resultado.erro }, { status: 409 });
  }

  const token = await criarTokenSessao(resultado.conta);
  const jar = await cookies();
  jar.set(NOME_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ ok: true, ...resultado.conta });
}
