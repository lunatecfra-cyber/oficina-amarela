import { postgresMissionQueue } from "@oficina/db/mission-queue";
import { NextResponse } from "next/server";
import { createMission } from "@/lib/missions-db";
import { readSession } from "@/lib/server-session";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json(
      { error: "Please log in first.", erro: "Please log in first." },
      { status: 401 },
    );
  }
  if (
    String(session.role) !== "spokesperson" &&
    String(session.role) !== "voz" &&
    String(session.role) !== "admin"
  ) {
    return NextResponse.json(
      {
        error: "Only spokespersons may dispatch missions.",
        erro: "Only spokespersons may dispatch missions.",
      },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const title = body?.title ?? body?.titulo;
  const rawFormat = body?.format ?? body?.formato;
  const format = rawFormat === "longo" || rawFormat === "long" ? "long" : "short";

  const rawFootageUrl = body?.rawFootageUrl ?? body?.driveLink ?? body?.videoBrutoUrl;
  const publishedYoutubeUrl = body?.publishedYoutubeUrl ?? body?.youtubeLink;
  const tone = body?.tone ?? body?.tom;
  const color = body?.color ?? body?.cor;
  const font = body?.font ?? body?.fonte;
  const refs = body?.refs;
  const extraInstructions = body?.extraInstructions ?? body?.extras;
  const rationale = body?.rationale ?? body?.motivo;
  const desiredDeadline = body?.desiredDeadline ?? body?.prazo;
  const watermarkUrl = body?.watermarkUrl ?? body?.marcaDagua;
  const campaignTaxId = body?.campaignTaxId ?? body?.cnpjCampanha;
  const voterRegistrationId = body?.voterRegistrationId ?? body?.tituloEleitor;

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json(
      { error: "Please provide a mission title.", erro: "Please provide a mission title." },
      { status: 400 },
    );
  }

  const result = await createMission({
    spokespersonId: session.id,
    title: title.trim(),
    format,
    rawFootageUrl: typeof rawFootageUrl === "string" ? rawFootageUrl : undefined,
    publishedYoutubeUrl: typeof publishedYoutubeUrl === "string" ? publishedYoutubeUrl : undefined,
    tone: typeof tone === "string" ? tone : undefined,
    color: typeof color === "string" ? color : undefined,
    font: typeof font === "string" ? font : undefined,
    refs: typeof refs === "string" ? refs : undefined,
    extraInstructions: typeof extraInstructions === "string" ? extraInstructions : undefined,
    rationale: typeof rationale === "string" ? rationale : undefined,
    desiredDeadline: typeof desiredDeadline === "string" ? desiredDeadline : undefined,
    watermarkUrl: typeof watermarkUrl === "string" ? watermarkUrl : undefined,
    campaignTaxId: typeof campaignTaxId === "string" ? campaignTaxId : undefined,
    voterRegistrationId: typeof voterRegistrationId === "string" ? voterRegistrationId : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, erro: result.error }, { status: 400 });
  }

  // Despacho dirigido por evento: a missão nova sai para um editor agora, sem
  // esperar a próxima varredura periódica.
  await postgresMissionQueue.dispatchOffers();

  return NextResponse.json({ ok: true, id: result.id });
}
