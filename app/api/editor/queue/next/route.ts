import { NextResponse } from "next/server";
import {
  acceptMissionOffer,
  dispatchMissions,
  expireStaleOffers,
  markEditorActive,
  pendingOfferForEditor,
  declineMissionOffer,
} from "@/lib/queue-db";
import { missionContacts } from "@/lib/missions-db";
import { notifyMissionAccepted } from "@/lib/email";
import { readSession } from "@/lib/server-session";

async function authenticateEditor() {
  const session = await readSession();
  if (!session) return { error: "Please log in first.", status: 401 as const };
  if (session.role !== "editor" && session.role !== "admin") {
    return { error: "Only editors may receive missions.", status: 403 as const };
  }
  return { session };
}

export async function GET() {
  const auth = await authenticateEditor();
  if ("error" in auth) return NextResponse.json({ error: auth.error, erro: auth.error }, { status: auth.status });

  await markEditorActive(auth.session.id);
  await expireStaleOffers();
  await dispatchMissions();

  const offer = await pendingOfferForEditor(auth.session.id);
  if (!offer) return new NextResponse(null, { status: 204 });

  return NextResponse.json(offer);
}

export async function POST(request: Request) {
  const auth = await authenticateEditor();
  if ("error" in auth) return NextResponse.json({ error: auth.error, erro: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  const missionId = Number(String(body?.missionId ?? body?.pautaId ?? "").replace(/^db-/, ""));
  if (!Number.isInteger(missionId)) {
    return NextResponse.json({ error: "Invalid mission identifier.", erro: "Invalid mission." }, { status: 400 });
  }

  await markEditorActive(auth.session.id);

  const rawAction = body?.action ?? body?.acao;
  const result =
    rawAction === "accept" || rawAction === "aceitar"
      ? await acceptMissionOffer(missionId, auth.session.id)
      : rawAction === "decline" || rawAction === "recusar"
        ? await declineMissionOffer(missionId, auth.session.id)
        : null;

  if (!result) {
    return NextResponse.json({ error: "Unknown queue action.", erro: "Unknown action." }, { status: 400 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error, erro: result.error }, { status: 409 });
  }

  if (rawAction === "decline" || rawAction === "recusar") {
    await dispatchMissions();
  }

  if (rawAction === "accept" || rawAction === "aceitar") {
    void (async () => {
      const c = await missionContacts(missionId);
      if (!c?.spokesperson) return;
      await notifyMissionAccepted(
        c.spokesperson.email,
        c.spokesperson.name,
        c.title,
        auth.session.handle,
        `${new URL(request.url).origin}/spokesperson/mission/db-${missionId}`
      );
    })().catch((e) => console.error("[notification] failed to notify acceptance", e));
  }

  return NextResponse.json({ ok: true });
}
