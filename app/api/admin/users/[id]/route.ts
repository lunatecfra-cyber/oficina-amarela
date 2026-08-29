import { NextResponse } from "next/server";
import { readSession } from "@/lib/server-session";
import { viewUserDetail } from "@/lib/admin-users";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Please log in.", erro: "Please log in." }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Inspector access required.", erro: "Admin only." }, { status: 403 });
  }

  const { id } = await context.params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Invalid user ID.", erro: "Invalid ID." }, { status: 400 });
  }

  const detail = await viewUserDetail(userId);
  if (!detail) return NextResponse.json({ error: "Account not found.", erro: "Not found." }, { status: 404 });

  return NextResponse.json({ user: detail, usuario: detail });
}
