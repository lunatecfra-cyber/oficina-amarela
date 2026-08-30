import type { UserSession } from "@oficina/auth/session";
import { claimPeriodicTask, QUEUE_SWEEP_TASK } from "@oficina/db/scheduler";
import { drainEmailQueueNow, queueMissionNotification } from "@oficina/email/dispatch";
import { buildMissionAcceptedEmail } from "@oficina/email/messages";
import { Hono } from "hono";
import type { ApiDependencies } from "../dependencies.ts";
import { queueMessage } from "../mission-queue-messages.ts";
import { requireEditor } from "../session.ts";

// A varredura global (expirar ofertas + despachar) roda no máximo uma vez a
// cada QUEUE_SWEEP_SECONDS, não uma vez por poll de cada editor.
const QUEUE_SWEEP_SECONDS = 5;

async function sweepQueueIfDue(queue: ApiDependencies["missionQueue"]) {
  if (!(await claimPeriodicTask(QUEUE_SWEEP_TASK, QUEUE_SWEEP_SECONDS))) return;
  await queue.expireOffers();
  await queue.dispatchOffers();
  // Retentativas da caixa de saída avançam junto: sem cron, é o tráfego que
  // move a fila. Vira Cron Trigger ou consumidor de Queue.
  await drainEmailQueueNow();
}

type QueueEnv = { Variables: { session: UserSession; requestId: string } };

export function createEditorQueue(dependencies: ApiDependencies) {
  const editorQueue = new Hono<QueueEnv>();
  const queue = dependencies.missionQueue;

  editorQueue.use("*", requireEditor);

  editorQueue.get("/next", async (c) => {
    const session = c.get("session");

    await queue.markEditorActive(session.id);
    await sweepQueueIfDue(queue);

    const offer = await queue.pendingOfferFor(session.id);
    if (!offer) return c.body(null, 204);

    return c.json(offer);
  });

  editorQueue.post("/next", async (c) => {
    const session = c.get("session");
    const body = await c.req.json().catch(() => null);

    const missionId = Number(String(body?.missionId ?? body?.pautaId ?? "").replace(/^db-/, ""));
    if (!Number.isInteger(missionId)) return c.json({ error: "Missão inválida." }, 400);

    const rawAction = body?.action ?? body?.acao;
    const accepting = rawAction === "accept" || rawAction === "aceitar";
    const declining = rawAction === "decline" || rawAction === "recusar";
    if (!accepting && !declining) return c.json({ error: "Ação desconhecida para a fila." }, 400);

    await queue.markEditorActive(session.id);

    const result = accepting
      ? await queue.acceptOffer(missionId, session.id)
      : await queue.rejectOffer(missionId, session.id);

    if (!result.ok) return c.json({ error: queueMessage(result.reason) }, 409);

    if (declining) {
      await queue.dispatchOffers();
      return c.json({ ok: true });
    }

    const contact = await dependencies.missionContacts(missionId);
    if (contact?.spokesperson) {
      const origin = new URL(c.req.url).origin;
      await queueMissionNotification(
        "aceite",
        missionId,
        contact.spokesperson.email,
        buildMissionAcceptedEmail(
          contact.spokesperson.name,
          contact.title,
          session.handle,
          `${origin}/porta-voz/missao/db-${missionId}`,
        ),
      );
    }

    // Entrega fora do caminho da requisição; nos Workers isso vira waitUntil.
    await drainEmailQueueNow();

    return c.json({ ok: true });
  });

  return editorQueue;
}
