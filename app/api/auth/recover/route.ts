import { NextResponse } from "next/server";
import { findAccountByEmail, recordAttempt, isRateLimited } from "@/lib/accounts";
import { requestIpAddress } from "@/lib/ip";
import { createRecoveryToken } from "@/lib/session";
import { isEmailConfigured, sendPasswordRecoveryEmail, isTestSender } from "@/lib/email";

const DEFAULT_RESPONSE = {
  ok: true,
  message: "If an account is associated with this email, a password recovery link has been dispatched.",
  mensagem: "If an account is associated with this email, a password recovery link has been dispatched.",
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body?.email;

  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "Please enter your email address.", erro: "Please enter your email address." }, { status: 400 });
  }

  if (!isEmailConfigured() || isTestSender()) {
    return NextResponse.json(
      {
        error: "Email dispatch service is currently unconfigured. If your account is connected with Google, please sign in via Google OAuth.",
        erro: "Email dispatch service is currently unconfigured.",
      },
      { status: 503 }
    );
  }

  const emailKey = `recover:${email}`;
  const ipKey = `recover-ip:${requestIpAddress(request)}`;

  const [lockEmail, lockIp] = await Promise.all([
    isRateLimited(emailKey),
    isRateLimited(ipKey),
  ]);
  if (lockEmail.locked || lockIp.locked) {
    return NextResponse.json(DEFAULT_RESPONSE);
  }

  await Promise.all([
    recordAttempt(emailKey, 3),
    recordAttempt(ipKey, 15),
  ]);

  const account = await findAccountByEmail(email);
  if (account) {
    const token = await createRecoveryToken(account.id);
    const origin = new URL(request.url).origin;
    const link = `${origin}/reset-password?token=${token}`;
    const sent = await sendPasswordRecoveryEmail(account.email, account.name, link);

    if (!sent) {
      return NextResponse.json(
        { error: "Could not send email right now. Please try again in a few minutes.", erro: "Could not send email right now." },
        { status: 503 }
      );
    }
  }

  return NextResponse.json(DEFAULT_RESPONSE);
}
