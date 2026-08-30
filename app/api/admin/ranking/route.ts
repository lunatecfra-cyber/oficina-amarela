import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  cancelElectoralApproval,
  grantConsistencyShield,
} from "@/lib/electoral-ranking-db";
import { getServerSession } from "@/lib/server-session";

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Faça login.", erro: "Faça login." }, { status: 401 });
  if (session.role !== "admin" && (session.role as string) !== "inspetor") {
    return NextResponse.json({ error: "Só o inspetor.", erro: "Só o inspetor." }, { status: 403 });
  }

  const audit = await sql`
    SELECT a.id, a.acao, a.entidade, a.entidade_id, a.detalhes, a.criado_em,
           u.nome AS ator_nome
    FROM auditoria_admin a LEFT JOIN users u ON u.id = a.ator_id
    ORDER BY a.criado_em DESC LIMIT 100
  `;
  return NextResponse.json({ audit, auditoria: audit });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Faça login.", erro: "Faça login." }, { status: 401 });
  if (session.role !== "admin" && (session.role as string) !== "inspetor") {
    return NextResponse.json({ error: "Só o inspetor.", erro: "Só o inspetor." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action ?? body?.acao;
  const reason = String(body?.reason ?? body?.motivo ?? "");

  let result;
  if (action === "cancel_approval" || action === "anular_aprovacao") {
    const missionId = Number(body?.missionId ?? body?.pautaId);
    if (!Number.isInteger(missionId) || missionId < 1) {
      return NextResponse.json({ error: "Missão inválida.", erro: "Missão inválida." }, { status: 400 });
    }
    result = await cancelElectoralApproval(missionId, session.id, reason);
  } else if (action === "grant_shield" || action === "conceder_bloqueio") {
    const editorId = Number(body?.editorId);
    if (!Number.isInteger(editorId) || editorId < 1) {
      return NextResponse.json({ error: "Editor inválido.", erro: "Editor inválido." }, { status: 400 });
    }
    result = await grantConsistencyShield(editorId, session.id, reason);
  } else {
    return NextResponse.json({ error: "Ação inválida.", erro: "Ação inválida." }, { status: 400 });
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
