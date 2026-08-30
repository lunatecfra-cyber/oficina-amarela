import { COOKIE_NAME, COOKIE_OPTS, createSessionToken } from "@oficina/auth/session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { updateAccountPassword } from "@/lib/accounts";
import { readSession } from "@/lib/server-session";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json(
      { error: "Faça login primeiro.", erro: "Faça login primeiro." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const newPassword = body?.newPassword ?? body?.novaSenha;

  if (typeof newPassword !== "string") {
    return NextResponse.json(
      { error: "Digite a nova senha.", erro: "Digite a nova senha." },
      { status: 400 },
    );
  }
  if (newPassword.length > 200) {
    return NextResponse.json(
      { error: "Senha longa demais.", erro: "Senha longa demais." },
      { status: 400 },
    );
  }

  const result = await updateAccountPassword(session.id, newPassword);
  if (!result.ok)
    return NextResponse.json({ error: result.error, erro: result.error }, { status: 400 });

  const token = await createSessionToken(session);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTS);

  return NextResponse.json({ ok: true });
}
