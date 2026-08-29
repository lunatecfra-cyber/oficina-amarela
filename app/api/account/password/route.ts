import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { updateAccountPassword } from "@/lib/accounts";
import { createSessionToken, COOKIE_NAME, COOKIE_OPTS } from "@/lib/session";
import { readSession } from "@/lib/server-session";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Please log in first.", erro: "Please log in first." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const newPassword = body?.newPassword ?? body?.novaSenha;

  if (typeof newPassword !== "string") {
    return NextResponse.json({ error: "Please enter new password.", erro: "Please enter new password." }, { status: 400 });
  }
  if (newPassword.length > 200) {
    return NextResponse.json({ error: "Password is too long.", erro: "Password is too long." }, { status: 400 });
  }

  const result = await updateAccountPassword(session.id, newPassword);
  if (!result.ok) return NextResponse.json({ error: result.error, erro: result.error }, { status: 400 });

  const token = await createSessionToken(session);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTS);

  return NextResponse.json({ ok: true });
}
