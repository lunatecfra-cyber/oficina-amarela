import { NextResponse } from "next/server";
import { buscarContaPorEmail, registrarTentativa, taxaTravada } from "@/lib/contas";
import { ipDaRequisicao } from "@/lib/ip";
import { criarTokenRecuperacao } from "@/lib/sessao";
import { emailConfigurado, enviarEmailRecuperacao } from "@/lib/email";

// mensagem sempre igual, exista ou não a conta — evita que alguém descubra
// quais e-mails têm cadastro só tentando recuperar senha
const MENSAGEM_PADRAO = {
  ok: true,
  mensagem: "Se esse e-mail tiver uma conta, mandamos um link de recuperação pra ele.",
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body?.email;

  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ erro: "Digite seu e-mail." }, { status: 400 });
  }

  // Dizia "falta RESEND_API_KEY" — nome de variável de ambiente na cara de quem
  // só quer voltar pra própria conta. A pessoa não pode fazer nada com essa
  // informação; o que ela precisa é do caminho que funciona.
  if (!emailConfigurado()) {
    return NextResponse.json(
      {
        erro: "O envio de e-mail ainda não está ligado. Se sua conta usa e-mail do Google, entra pelo botão do Google aqui em cima — cai na mesma conta.",
      },
      { status: 503 }
    );
  }

  // Dois freios, porque são dois abusos diferentes:
  //  - por e-mail: impede encher a caixa de UMA pessoa de link de recuperação
  //  - por IP: impede varrer muitos e-mails a partir do mesmo lugar
  // Ambos respondem a MENSAGEM_PADRAO quando travam: dizer "você está
  // bloqueado" já entregaria que aquele e-mail tem conta.
  const chaveEmail = `recuperar:${email}`;
  const chaveIp = `recuperar-ip:${ipDaRequisicao(request)}`;

  const [travaEmail, travaIp] = await Promise.all([
    taxaTravada(chaveEmail),
    taxaTravada(chaveIp),
  ]);
  if (travaEmail.travado || travaIp.travado) {
    return NextResponse.json(MENSAGEM_PADRAO);
  }

  await Promise.all([
    registrarTentativa(chaveEmail, 3),
    registrarTentativa(chaveIp, 15),
  ]);

  const conta = await buscarContaPorEmail(email);
  if (conta) {
    const token = await criarTokenRecuperacao(conta.id);
    const origem = new URL(request.url).origin;
    const link = `${origem}/redefinir-senha?token=${token}`;
    const enviou = await enviarEmailRecuperacao(conta.email, conta.nome, link);

    // Falha de infraestrutura NÃO pode virar "mandamos o link": a pessoa
    // ficaria esperando pra sempre um e-mail que não saiu. O sigilo sobre
    // quem tem conta continua valendo pro caso "não achei" logo abaixo —
    // aqui o problema é nosso, e quem está esperando precisa saber.
    if (!enviou) {
      return NextResponse.json(
        { erro: "Não deu pra mandar o e-mail agora. Tenta de novo em alguns minutos." },
        { status: 503 }
      );
    }
  }

  return NextResponse.json(MENSAGEM_PADRAO);
}
