import { type EmailToQueue, enqueueEmails } from "@oficina/db/email-queue";
import { drainEmailQueueNow } from "@oficina/email/dispatch";
import {
  buildEditorsQueueEmail,
  buildFreeEditorsEmail,
  isEmailConfigured,
} from "@oficina/email/messages";
import { after, NextResponse } from "next/server";
import {
  candidateNotificationEmails,
  editorNotificationEmails,
  systemOverviewSummary,
} from "@/lib/overview-db";
import { readSession } from "@/lib/server-session";

/**
 * Janela de idempotência do broadcast. A mesma pessoa não recebe o mesmo aviso
 * duas vezes dentro da hora, nem se o inspetor clicar de novo ou a requisição
 * for repetida.
 */
function broadcastKey(group: string, userEmail: string): string {
  const hour = new Date().toISOString().slice(0, 13);
  return `broadcast:${group}:${userEmail.toLowerCase()}:${hour}`;
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session)
    return NextResponse.json({ error: "Faça login.", erro: "Faça login." }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json(
      { error: "Só o inspetor pode disparar avisos.", erro: "Só o inspetor." },
      { status: 403 },
    );
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Serviço de e-mail não configurado.", erro: "Email não configurado." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const rawType = body?.type ?? body?.tipo;
  const type =
    rawType === "editors" || rawType === "editores"
      ? "editors"
      : rawType === "candidates" || rawType === "candidatos"
        ? "candidates"
        : null;

  if (!type) {
    return NextResponse.json(
      { error: "Grupo de destinatários inválido.", erro: "Grupo inválido." },
      { status: 400 },
    );
  }

  const origin = new URL(request.url).origin;
  const summary = await systemOverviewSummary();

  if (type === "editors") {
    if (summary.inQueue === 0) {
      return NextResponse.json(
        { error: "Nenhuma missão aguardando na fila.", erro: "Nenhuma missão na fila." },
        { status: 400 },
      );
    }
    const recipients = await editorNotificationEmails();
    const messages: EmailToQueue[] = recipients.map((p) => {
      const { subject, html } = buildEditorsQueueEmail(p.name, summary.inQueue, `${origin}/editor`);
      return { key: broadcastKey("editors", p.email), to: p.email, subject, html };
    });

    const queued = await enqueueEmails(messages);
    after(drainEmailQueueNow);

    return NextResponse.json({ ok: true, sent: queued, enviados: queued });
  }

  if (summary.freeEditors === 0) {
    return NextResponse.json(
      { error: "Nenhum editor disponível no momento.", erro: "Nenhum editor livre." },
      { status: 400 },
    );
  }
  const recipients = await candidateNotificationEmails();
  const messages: EmailToQueue[] = recipients.map((p) => {
    const { subject, html } = buildFreeEditorsEmail(
      p.name,
      summary.freeEditors,
      `${origin}/porta-voz/nova-pauta`,
    );
    return { key: broadcastKey("candidates", p.email), to: p.email, subject, html };
  });

  const queued = await enqueueEmails(messages);
  after(drainEmailQueueNow);

  return NextResponse.json({ ok: true, sent: queued, enviados: queued });
}
