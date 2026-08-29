import { NextResponse } from "next/server";
import { obterProgressoEditor } from "@/lib/ranking-eleitoral-db";
import { lerSessao } from "@/lib/sessao-servidor";

export async function GET() {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  if (sessao.papel !== "editor" && sessao.papel !== "admin") {
    return NextResponse.json({ erro: "Só editor." }, { status: 403 });
  }
  return NextResponse.json(await obterProgressoEditor(sessao.id));
}
