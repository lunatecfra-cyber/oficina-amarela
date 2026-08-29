import { NextResponse } from "next/server";
import { readSession } from "@/lib/server-session";
import { resolveModerationReport } from "@/lib/reports-db";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Please log in.", erro: "Please log in." }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Inspector access required.", erro: "Admin only." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const reportId = body?.reportId ?? body?.denunciaId;
  const rawAction = body?.action ?? body?.acao;
  const action = rawAction === "resolve" || rawAction === "resolver" || rawAction === "resolved" || rawAction === "resolvida" ? "resolved" : rawAction === "dismiss" || rawAction === "ignorar" || rawAction === "ignored" || rawAction === "ignorada" ? "ignored" : null;

  if (typeof reportId !== "number" || !Number.isFinite(reportId)) {
    return NextResponse.json({ error: "Invalid report identifier.", erro: "Invalid report." }, { status: 400 });
  }
  if (!action) {
    return NextResponse.json({ error: "Invalid resolution action.", erro: "Invalid action." }, { status: 400 });
  }

  const result = await resolveModerationReport(reportId, action);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, erro: result.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
