import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { criarConta, checarVagaPapel, registrarTentativa, taxaTravada } from "@/lib/contas";
import { ipDaRequisicao } from "@/lib/ip";
import { criarTokenSessao, NOME_COOKIE, COOKIE_OPTS } from "@/lib/sessao";

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

  // checa teto de vagas ANTES de criar — se lotou, não gasta tentativa do
  // freio de IP, porque não é culpa de quem está tentando se cadastrar.
  const vaga = await checarVagaPapel(papel);
  if (!vaga.ok) {
    return NextResponse.json({ erro: vaga.erro }, { status: 403 });
  }

  const resultado = await criarConta({ nome, apelido, email, senha, papel });

  if (!resultado.ok) {
    // Erro de digitação não gasta tentativa. Antes gastava, e o efeito era
    // este: oito formulários mal preenchidos — senha curta, apelido com
    // espaço, nome vazio — travavam o cadastro por 15 minutos sem que uma
    // única conta tivesse sido criada. Quem paga isso é justamente quem está
    // com dificuldade de preencher, e num escritório com wi-fi compartilhado
    // as tentativas ainda somam entre pessoas diferentes.
    //
    // O freio continua valendo pro que ele existia pra impedir: quem varre
    // apelidos pra descobrir quais já existem passa por aqui como conflito,
    // porque a requisição dele é bem formada.
    if (resultado.conflito) {
      await registrarTentativa(chave, MAX_CADASTROS_POR_IP);
    }
    return NextResponse.json(
      { erro: resultado.erro },
      // 409 é "conflito com o que já existe" — só cabe em apelido ou e-mail
      // repetido. Preenchimento inválido é 400.
      { status: resultado.conflito ? 409 : 400 }
    );
  }

  await registrarTentativa(chave, MAX_CADASTROS_POR_IP);

  const token = await criarTokenSessao(resultado.conta);
  const jar = await cookies();
  jar.set(NOME_COOKIE, token, COOKIE_OPTS);

  return NextResponse.json({ ok: true, ...resultado.conta });
}
