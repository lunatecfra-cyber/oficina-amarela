import { NextResponse } from "next/server";
import { deleteMissionPermanently } from "@/lib/missions-db";
import { readSession } from "@/lib/server-session";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Please log in.", erro: "Please log in." }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Inspector access required.", erro: "Admin only." }, { status: 403 });
  }

  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "Invalid mission identifier.", erro: "Invalid mission." }, { status: 400 });
  }

  const result = await deleteMissionPermanently(id);
  if (!result.ok) return NextResponse.json({ error: result.error, erro: result.error }, { status: 404 });

  return NextResponse.json({ ok: true });
}
