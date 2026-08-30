import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { readSession } from "@/lib/server-session";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session)
    return NextResponse.json(
      { error: "Faça login primeiro.", erro: "Faça login primeiro." },
      { status: 401 },
    );

  const body = await request.json().catch(() => null);
  const grid = body?.schedule ?? body?.disponibilidade;

  const isValid =
    Array.isArray(grid) &&
    grid.length === 3 &&
    grid.every((l: unknown) => Array.isArray(l) && l.length === 7);

  if (!isValid)
    return NextResponse.json(
      { error: "Grade de disponibilidade inválida.", erro: "Grade de disponibilidade inválida." },
      { status: 400 },
    );

  await sql`
    UPDATE users SET disponibilidade = ${sql.json(
      grid.map((l: unknown[]) => l.map(Boolean)),
    )} WHERE id = ${session.id}
  `;
  return NextResponse.json({ ok: true });
}
