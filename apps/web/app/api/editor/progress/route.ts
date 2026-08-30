import { NextResponse } from "next/server";
import { getEditorProgress } from "@/lib/electoral-ranking-db";
import { getServerSession } from "@/lib/server-session";

export async function GET() {
  const session = await getServerSession();
  if (!session)
    return NextResponse.json({ error: "Faça login.", erro: "Faça login." }, { status: 401 });
  if (
    session.role !== "editor" &&
    session.role !== "admin" &&
    (session.role as string) !== "inspetor"
  ) {
    return NextResponse.json({ error: "Só editor.", erro: "Só editor." }, { status: 403 });
  }
  return NextResponse.json(await getEditorProgress(session.id));
}
