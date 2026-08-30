import { claimPeriodicTask, QUEUE_SWEEP_TASK } from "@oficina/db/scheduler";
import { after, NextResponse } from "next/server";
import { buildMissionAcceptedEmail } from "@/lib/email";
import { drainEmailQueueNow, queueMissionNotification } from "@/lib/email-dispatch";
import { missionContacts } from "@/lib/missions-db";
import {
  acceptMissionOffer,
  declineMissionOffer,
  dispatchMissions,
  expireStaleOffers,
  markEditorActive,
  pendingOfferForEditor,
} from "@/lib/queue-db";
import { readSession } from "@/lib/server-session";

// A varredura global (expirar ofertas + despachar) roda no máximo uma vez a
// cada QUEUE_SWEEP_SECONDS, não uma vez por poll de cada editor.
const QUEUE_SWEEP_SECONDS = 5;

async function sweepQueueIfDue() {
  if (!(await claimPeriodicTask(QUEUE_SWEEP_TASK, QUEUE_SWEEP_SECONDS))) return;
  await expireStaleOffers();
  await dispatchMissions();
  // Retentativas da caixa de saída avançam junto: sem cron, é o tráfego que
  // move a fila. Na Cloudflare isso vira Cron Trigger ou consumidor de Queue.
  await drainEmailQueueNow();
}

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
  if ("error" in auth)
    return NextResponse.json({ error: auth.error, erro: auth.error }, { status: auth.status });

  await markEditorActive(auth.session.id);
  await sweepQueueIfDue();

  const offer = await pendingOfferForEditor(auth.session.id);
  if (!offer) return new NextResponse(null, { status: 204 });

  return NextResponse.json(offer);
}

export async function POST(request: Request) {
  const auth = await authenticateEditor();
  if ("error" in auth)
    return NextResponse.json({ error: auth.error, erro: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  const missionId = Number(String(body?.missionId ?? body?.pautaId ?? "").replace(/^db-/, ""));
  if (!Number.isInteger(missionId)) {
    return NextResponse.json(
      { error: "Invalid mission identifier.", erro: "Invalid mission." },
      { status: 400 },
    );
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
    return NextResponse.json(
      { error: "Unknown queue action.", erro: "Unknown action." },
      { status: 400 },
    );
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error, erro: result.error }, { status: 409 });
  }

  if (rawAction === "decline" || rawAction === "recusar") {
    await dispatchMissions();
  }

  if (rawAction === "accept" || rawAction === "aceitar") {
    // Antes isto era uma promessa solta: em ambiente serverless ela morre com a
    // resposta e o porta-voz nunca era avisado. Enfileirar é rápido e acontece
    // dentro da requisição; a entrega vai para depois dela.
    await (async () => {
      const c = await missionContacts(missionId);
      if (!c?.spokesperson) return;
      await queueMissionNotification(
        "aceite",
        missionId,
        c.spokesperson.email,
        buildMissionAcceptedEmail(
          c.spokesperson.name,
          c.title,
          auth.session.handle,
          `${new URL(request.url).origin}/porta-voz/missao/db-${missionId}`,
        ),
      );
    })().catch((e) => console.error("[notification] failed to notify acceptance", e));
    after(drainEmailQueueNow);
  }

  return NextResponse.json({ ok: true });
}
