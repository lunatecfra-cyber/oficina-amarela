import { NextResponse } from "next/server";
import { saveEditableProfile } from "@/lib/profile-db";
import { readSession } from "@/lib/server-session";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Please log in first.", erro: "Please log in first." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const headline = body?.headline;
  const bio = body?.bio;
  const location = body?.location ?? body?.localizacao;

  const result = await saveEditableProfile(session.id, {
    headline: Array.isArray(headline) ? headline : undefined,
    bio: typeof bio === "string" ? bio : undefined,
    location: typeof location === "string" ? location : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, erro: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
