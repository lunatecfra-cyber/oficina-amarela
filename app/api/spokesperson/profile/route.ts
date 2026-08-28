import { NextResponse } from "next/server";
import { saveCandidateOnboarding } from "@/lib/candidate-db";
import { readSession } from "@/lib/server-session";
import type { SocialLinks } from "@/lib/candidates";

const toStringOpt = (v: unknown) => (typeof v === "string" ? v : undefined);
const toStringList = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

function parseSocials(v: unknown): SocialLinks {
  if (typeof v !== "object" || v === null) return {};
  const r = v as Record<string, unknown>;
  const socials: SocialLinks = {};
  for (const field of ["instagram", "youtube", "tiktok", "x"] as const) {
    if (typeof r[field] === "string" && r[field].trim()) socials[field] = r[field].trim();
  }
  return socials;
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Please log in first.", erro: "Please log in first." }, { status: 401 });
  if (String(session.role) !== "spokesperson" && String(session.role) !== "voz" && String(session.role) !== "admin") {
    return NextResponse.json({ error: "Only spokespersons may configure candidate profiles.", erro: "Only spokespersons." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = body?.name ?? body?.nome;
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Please enter candidate name.", erro: "Please enter candidate name." }, { status: 400 });
  }

  const result = await saveCandidateOnboarding(session.id, {
    name: name.trim(),
    photoUrl: toStringOpt(body?.photoUrl ?? body?.fotoUrl),
    politicalOffice: toStringOpt(body?.politicalOffice ?? body?.cargo),
    runningFor: toStringOpt(body?.runningFor ?? body?.disputaPor),
    electionYear: toStringOpt(body?.electionYear ?? body?.anoEleicao),
    location: toStringOpt(body?.location ?? body?.localizacao),
    policyFlags: toStringList(body?.policyFlags ?? body?.bandeiras),
    communicationTone: toStringOpt(body?.communicationTone ?? body?.tomComunicacao),
    keywords: toStringList(body?.keywords ?? body?.palavrasChave),
    socialLinks: parseSocials(body?.socialLinks ?? body?.redes),
    bio: toStringOpt(body?.bio),
    watermarkUrl: toStringOpt(body?.watermarkUrl ?? body?.marcaDagua),
    campaignTaxId: toStringOpt(body?.campaignTaxId ?? body?.cnpjCampanha),
    voterRegistrationId: toStringOpt(body?.voterRegistrationId ?? body?.tituloEleitor),
  });

  if (!result.ok) return NextResponse.json({ error: result.error, erro: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
