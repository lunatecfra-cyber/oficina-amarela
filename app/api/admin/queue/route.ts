import { NextResponse } from "next/server";
import { moveInQueue, type QueueMovement } from "@/lib/overview-db";
import { readSession } from "@/lib/server-session";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Please log in.", erro: "Please log in." }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Inspector access required.", erro: "Admin only." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = body?.id;
  const rawMovement = body?.movement ?? body?.movimento;
  const movement: QueueMovement =
    rawMovement === "top" || rawMovement === "topo"
      ? "top"
      : rawMovement === "up" || rawMovement === "subir"
        ? "up"
        : rawMovement === "down" || rawMovement === "descer"
          ? "down"
          : ("up" as QueueMovement);

  if (typeof id !== "number" || !Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid mission identifier.", erro: "Invalid mission." }, { status: 400 });
  }

  const result = await moveInQueue(id, movement);
  if (!result.ok) return NextResponse.json({ error: result.error, erro: result.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}
