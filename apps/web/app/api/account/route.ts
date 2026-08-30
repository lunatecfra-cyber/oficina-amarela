import { COOKIE_NAME } from "@oficina/auth/session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteAccount } from "@/lib/accounts";
import { readSession } from "@/lib/server-session";

export async function DELETE(request: Request) {
  const session = await readSession();
  if (!session)
    return NextResponse.json(
      { error: "Faça login primeiro.", erro: "Faça login primeiro." },
      { status: 401 },
    );

  const body = await request.json().catch(() => null);
  const confirmation = body?.confirmation ?? body?.confirmacao;

  if (typeof confirmation !== "string" || !confirmation) {
    return NextResponse.json(
      { error: "Confirme o apelido da conta antes de apagar.", erro: "Confirme o apelido." },
      { status: 400 },
    );
  }

  const result = await deleteAccount(session.id, confirmation);
  if (!result.ok)
    return NextResponse.json({ error: result.error, erro: result.error }, { status: 403 });

  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);

  return NextResponse.json({ ok: true });
}
