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
  if (!session) return NextResponse.json({ error: "Please log in.", erro: "Please log in." }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Inspector access required.", erro: "Admin only." }, { status: 403 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Email delivery service unconfigured.", erro: "Email unconfigured." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const rawType = body?.type ?? body?.tipo;
  const type = rawType === "editors" || rawType === "editores" ? "editors" : rawType === "candidates" || rawType === "candidatos" ? "candidates" : null;

  if (!type) {
    return NextResponse.json({ error: "Invalid broadcast target group.", erro: "Invalid group." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const summary = await systemOverviewSummary();

  if (type === "editors") {
    if (summary.inQueue === 0) {
      return NextResponse.json({ error: "No missions currently waiting in queue.", erro: "No missions in queue." }, { status: 400 });
    }
    const recipients = await editorNotificationEmails();
    for (const p of recipients) {
      void notifyEditorsOfQueueMissions(p.email, p.name, summary.inQueue, `${origin}/editor`);
    }
    return NextResponse.json({ ok: true, sent: recipients.length, enviados: recipients.length });
  }

  if (summary.freeEditors === 0) {
    return NextResponse.json({ error: "No video editors currently idle.", erro: "No free editors." }, { status: 400 });
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
