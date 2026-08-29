import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteAccount } from "@/lib/accounts";
import { COOKIE_NAME } from "@/lib/session";
import { readSession } from "@/lib/server-session";

export async function DELETE(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Please log in first.", erro: "Please log in first." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const confirmation = body?.confirmation ?? body?.confirmacao;

  if (typeof confirmation !== "string" || !confirmation) {
    return NextResponse.json(
      { error: "Please confirm account handle before deletion.", erro: "Please confirm." },
      { status: 400 }
    );
  }

  const result = await deleteAccount(session.id, confirmation);
  if (!result.ok) return NextResponse.json({ error: result.error, erro: result.error }, { status: 403 });

  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);

  return NextResponse.json({ ok: true });
}
