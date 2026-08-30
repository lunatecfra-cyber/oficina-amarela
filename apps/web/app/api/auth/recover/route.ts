import { NextResponse } from "next/server";
import { findAccountByEmail, isRateLimited, recordAttempt } from "@/lib/accounts";
import { isEmailConfigured, isTestSender, sendPasswordRecoveryEmail } from "@/lib/email";
import { requestIpAddress } from "@/lib/ip";
import { createRecoveryToken } from "@/lib/session";

const DEFAULT_RESPONSE = {
  ok: true,
  message: "Se houver uma conta com esse e-mail, enviamos o link pra redefinir a senha.",
  mensagem: "Se houver uma conta com esse e-mail, enviamos o link pra redefinir a senha.",
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body?.email;

  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json(
      { error: "Digite seu e-mail.", erro: "Digite seu e-mail." },
      { status: 400 },
    );
  }

  if (!isEmailConfigured() || isTestSender()) {
    return NextResponse.json(
      {
        error:
          "Envio de e-mail não configurado. Se você criou a conta com o Google, pode entrar por lá.",
        erro: "Envio de e-mail não configurado.",
      },
      { status: 503 },
    );
  }

  const emailKey = `recover:${email}`;
  const ipKey = `recover-ip:${requestIpAddress(request)}`;

  const [lockEmail, lockIp] = await Promise.all([isRateLimited(emailKey), isRateLimited(ipKey)]);
  if (lockEmail.locked || lockIp.locked) {
    return NextResponse.json(DEFAULT_RESPONSE);
  }

  await Promise.all([recordAttempt(emailKey, 3), recordAttempt(ipKey, 15)]);

  const account = await findAccountByEmail(email);
  if (account) {
    const token = await createRecoveryToken(account.id);
    const origin = new URL(request.url).origin;
    const link = `${origin}/redefinir-senha?token=${token}`;
    const sent = await sendPasswordRecoveryEmail(account.email, account.name, link);

    if (!sent) {
      return NextResponse.json(
        {
          error: "Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos.",
          erro: "Não foi possível enviar o e-mail agora.",
        },
        { status: 503 },
      );
    }
  }

  return NextResponse.json(DEFAULT_RESPONSE);
}
