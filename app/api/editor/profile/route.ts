import { NextResponse } from "next/server";
import { saveEditorOnboarding } from "@/lib/profile-db";
import { readSession } from "@/lib/server-session";

const toStringOpt = (v: unknown) => (typeof v === "string" ? v : undefined);
const toStringList = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Please log in first.", erro: "Please log in first." }, { status: 401 });
  if (session.role !== "editor" && session.role !== "admin") {
    return NextResponse.json({ error: "Only editors may complete this profile.", erro: "Only editors." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = body?.name ?? body?.nome;
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Please enter your name.", erro: "Please enter your name." }, { status: 400 });
  }

  const rawGrid = body?.availabilitySchedule ?? body?.disponibilidade;
  const scheduleMatrix: boolean[][] | undefined =
    Array.isArray(rawGrid) && rawGrid.length === 3 && rawGrid.every((l) => Array.isArray(l) && l.length === 7)
      ? rawGrid.map((l: unknown[]) => l.map(Boolean))
      : undefined;

  const result = await saveEditorOnboarding(session.id, {
    name: name.trim(),
    photoUrl: toStringOpt(body?.photoUrl ?? body?.fotoUrl),
    location: toStringOpt(body?.location ?? body?.localizacao),
    headline: toStringList(body?.headline),
    bio: toStringOpt(body?.bio),
    softwares: toStringList(body?.softwares),
    styles: toStringList(body?.styles ?? body?.estilos),
    editingExperienceLevel: toStringOpt(body?.editingExperienceLevel ?? body?.nivelEdicao),
    pcSetup: toStringOpt(body?.pcSetup ?? body?.setupPc),
    portfolioLink: toStringOpt(body?.portfolioLink),
    niche: toStringList(body?.niche ?? body?.nicho),
    availabilitySchedule: scheduleMatrix,
  });

  if (!result.ok) return NextResponse.json({ error: result.error, erro: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
