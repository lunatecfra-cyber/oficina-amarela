import { NextResponse } from "next/server";
import {
  createSpokespersonInvitation,
  listSpokespersonInvitations,
  revokeSpokespersonInvitation,
} from "@/lib/invitations-db";
import { getServerSession } from "@/lib/server-session";

async function requireInspector() {
  const session = await getServerSession();
  if (!session)
    return {
      error: NextResponse.json({ error: "Faça login.", erro: "Faça login." }, { status: 401 }),
    };
  if (session.role !== "admin" && (session.role as string) !== "inspetor") {
    return {
      error: NextResponse.json(
        { error: "Só o inspetor.", erro: "Só o inspetor." },
        { status: 403 },
      ),
    };
  }
  return { session };
}

export async function GET() {
  const access = await requireInspector();
  if ("error" in access) return access.error;
  const invitations = await listSpokespersonInvitations();
  return NextResponse.json({ invitations, convites: invitations });
}

export async function POST(request: Request) {
  const access = await requireInspector();
  if ("error" in access) return access.error;
  const body = await request.json().catch(() => null);

  const action = body?.action ?? body?.acao;
  if (action === "revoke" || action === "revogar") {
    const id = Number(body?.id);
    if (!Number.isInteger(id)) {
      return NextResponse.json(
        { error: "Convite inválido.", erro: "Convite inválido." },
        { status: 400 },
      );
    }
    const result = await revokeSpokespersonInvitation(id, access.session.id);
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  }

  const email = String(body?.email ?? "");
  const result = await createSpokespersonInvitation(email, access.session.id);
  if (!result.ok) return NextResponse.json(result, { status: 400 });

  const origin = new URL(request.url).origin;
  const link = `${origin}/criar-conta?convite=${encodeURIComponent(result.token)}`;

  return NextResponse.json({
    ...result,
    link,
  });
}
