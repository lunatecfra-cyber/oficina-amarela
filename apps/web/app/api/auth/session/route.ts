import { NextResponse } from "next/server";
import { readSession } from "@/lib/server-session";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json(null, { status: 401 });
  return NextResponse.json(session);
}
