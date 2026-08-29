import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  anularAprovacaoEleitoral,
  concederBloqueio,
} from "@/lib/ranking-eleitoral-db";
import { lerSessao } from "@/lib/sessao-servidor";

export async function GET() {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  if (sessao.papel !== "admin") return NextResponse.json({ erro: "Só o inspetor." }, { status: 403 });
  const auditoria = await sql`
    SELECT a.id, a.acao, a.entidade, a.entidade_id, a.detalhes, a.criado_em,
           u.nome AS ator_nome
    FROM auditoria_admin a LEFT JOIN users u ON u.id = a.ator_id
    ORDER BY a.criado_em DESC LIMIT 100
  `;
  return NextResponse.json({ auditoria });
}

export async function POST(request: Request) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  if (sessao.papel !== "admin") return NextResponse.json({ erro: "Só o inspetor." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const motivo = String(body?.motivo ?? "");
  let resultado;
  if (body?.acao === "anular_aprovacao") {
    const pautaId = Number(body?.pautaId);
    if (!Number.isInteger(pautaId) || pautaId < 1) {
      return NextResponse.json({ erro: "Missão inválida." }, { status: 400 });
    }
    resultado = await anularAprovacaoEleitoral(pautaId, sessao.id, motivo);
  } else if (body?.acao === "conceder_bloqueio") {
    const editorId = Number(body?.editorId);
    if (!Number.isInteger(editorId) || editorId < 1) {
      return NextResponse.json({ erro: "Editor inválido." }, { status: 400 });
    }
    resultado = await concederBloqueio(editorId, sessao.id, motivo);
  } else {
    return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
  }
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 409 });
}
