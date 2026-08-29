import { NextResponse } from "next/server";
import { obterRankingEleitoral } from "@/lib/ranking-eleitoral-db";
import { lerSessao } from "@/lib/sessao-servidor";

export async function GET() {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  return NextResponse.json(await obterRankingEleitoral());
}
