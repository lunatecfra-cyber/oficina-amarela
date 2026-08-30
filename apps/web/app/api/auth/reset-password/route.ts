import { verifyRecoveryToken } from "@oficina/auth/session";
import { NextResponse } from "next/server";
import { isRecoveryTokenAlreadyUsed, updateAccountPassword } from "@/lib/accounts";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = body?.token;
  const password = body?.password ?? body?.senha;

  if (typeof token !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "Preencha a nova senha.", erro: "Preencha a nova senha." },
      { status: 400 },
    );
  }

  const data = await verifyRecoveryToken(token);
  if (!data) {
    return NextResponse.json(
      { error: "Link inválido ou expirado. Peça outro.", erro: "Link inválido ou expirado." },
      { status: 401 },
    );
  }

  if (await isRecoveryTokenAlreadyUsed(data.userId, data.issuedAtMs)) {
    return NextResponse.json(
      {
        error: "Link expirado ou já utilizado. Peça outro.",
        erro: "Link expirado ou já utilizado.",
      },
      { status: 401 },
    );
  }

  const result = await updateAccountPassword(data.userId, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, erro: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
