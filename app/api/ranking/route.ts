import { NextResponse } from "next/server";
import { getElectoralRanking } from "@/lib/electoral-ranking-db";
import { getServerSession } from "@/lib/server-session";

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Faça login.", erro: "Faça login." }, { status: 401 });
  return NextResponse.json(await getElectoralRanking());
}
