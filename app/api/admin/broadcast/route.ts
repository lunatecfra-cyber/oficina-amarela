import { NextResponse } from "next/server";
import {
  systemOverviewSummary,
  editorNotificationEmails,
  candidateNotificationEmails,
} from "@/lib/overview-db";
import {
  notifyEditorsOfQueueMissions,
  notifySpokespersonsOfAvailableEditors,
  isEmailConfigured,
} from "@/lib/email";
import { readSession } from "@/lib/server-session";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Faça login.", erro: "Faça login." }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Só o inspetor pode disparar avisos.", erro: "Só o inspetor." }, { status: 403 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Serviço de e-mail não configurado.", erro: "Email não configurado." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const rawType = body?.type ?? body?.tipo;
  const type = rawType === "editors" || rawType === "editores" ? "editors" : rawType === "candidates" || rawType === "candidatos" ? "candidates" : null;

  if (!type) {
    return NextResponse.json({ error: "Grupo de destinatários inválido.", erro: "Grupo inválido." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const summary = await systemOverviewSummary();

  if (type === "editors") {
    if (summary.inQueue === 0) {
      return NextResponse.json({ error: "Nenhuma missão aguardando na fila.", erro: "Nenhuma missão na fila." }, { status: 400 });
    }
    const recipients = await editorNotificationEmails();
    for (const p of recipients) {
      void notifyEditorsOfQueueMissions(p.email, p.name, summary.inQueue, `${origin}/editor`);
    }
    return NextResponse.json({ ok: true, sent: recipients.length, enviados: recipients.length });
  }

  if (summary.freeEditors === 0) {
    return NextResponse.json({ error: "Nenhum editor disponível no momento.", erro: "Nenhum editor livre." }, { status: 400 });
  }
  const recipients = await candidateNotificationEmails();
  for (const p of recipients) {
    void notifySpokespersonsOfAvailableEditors(
      p.email,
      p.name,
      summary.freeEditors,
      `${origin}/porta-voz/nova-pauta`
    );
  }
  return NextResponse.json({ ok: true, sent: recipients.length, enviados: recipients.length });
}
