import { createApp } from "@oficina/api/app";
import { migratedMissionAction } from "@oficina/api/mission-actions";
import { missionContacts } from "@oficina/db/mission-contacts";
import { canExecuteAction } from "@oficina/domain/mission-transitions";
import { drainEmailQueueNow, queueMissionNotification } from "@oficina/email/dispatch";
import { buildApprovedDeliveryEmail } from "@oficina/email/messages";
import { after, NextResponse } from "next/server";
import { messagesOfMission, messagesOfMissionAfter, sendMessage } from "@/lib/chat-db";
import { sql } from "@/lib/db";
import { approveMission } from "@/lib/missions-db";
import { createModerationReport } from "@/lib/reports-db";
import { readSession } from "@/lib/server-session";

const api = createApp();

function toApiRequest(request: Request): Request {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/api/, "");
  return new Request(url, request);
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session)
    return NextResponse.json(
      { error: "Please log in first.", erro: "Please log in first." },
      { status: 401 },
    );

  const { id } = await ctx.params;
  const missionId = Number(String(id).replace(/^db-/, ""));
  if (!Number.isInteger(missionId)) {
    return NextResponse.json(
      { error: "Invalid mission identifier.", erro: "Invalid mission identifier." },
      { status: 400 },
    );
  }

  const [mission] = await sql`
    SELECT porta_voz_id, reservada_por_id FROM pautas WHERE id = ${missionId}
  `;
  if (!mission)
    return NextResponse.json(
      { error: "Mission not found.", erro: "Mission not found." },
      { status: 404 },
    );

  const isOwner = mission.porta_voz_id === session.id;
  const isAssignedEditor = mission.reservada_por_id === session.id;
  if (!isOwner && !isAssignedEditor && session.role !== "admin") {
    return NextResponse.json(
      { error: "Unauthorized access to this mission.", erro: "Unauthorized access." },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const after = url.searchParams.get("after") ?? url.searchParams.get("depois");
  const messages = after
    ? await messagesOfMissionAfter(missionId, after)
    : await messagesOfMission(missionId);

  return NextResponse.json({ messages, mensagens: messages });
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const body = await request
    .clone()
    .json()
    .catch(() => null);
  if (migratedMissionAction(body?.action ?? body?.acao)) {
    return api.fetch(toApiRequest(request));
  }

  const session = await readSession();
  if (!session)
    return NextResponse.json(
      { error: "Please log in first.", erro: "Please log in first." },
      { status: 401 },
    );

  const { id } = await ctx.params;
  const missionId = Number(String(id).replace(/^db-/, ""));
  if (!Number.isInteger(missionId)) {
    return NextResponse.json(
      { error: "Demo missions are static previews.", erro: "Demo mission." },
      { status: 400 },
    );
  }

  const rawAction = body?.action ?? body?.acao;

  // normalize action
  const actionMap: Record<string, string> = {
    reserve: "reserve",
    reservar: "reserve",
    cancel: "cancel",
    cancelar: "cancel",
    deliver: "deliver",
    entregar: "deliver",
    approve: "approve",
    aprovar: "approve",
    re_edit: "re_edit",
    reedicao: "re_edit",
    accept: "accept",
    aceitar: "accept",
    adjust: "adjust",
    ajuste: "adjust",
    message: "message",
    mensagem: "message",
    report: "report",
    denunciar: "report",
  };
  const action = actionMap[rawAction] ?? rawAction;

  const [currentMission] = await sql`
    SELECT status FROM pautas WHERE id = ${missionId}
  `;
  if (!currentMission)
    return NextResponse.json(
      { error: "Mission not found.", erro: "Mission not found." },
      { status: 404 },
    );
  if (!canExecuteAction(String(currentMission.status), session.role, String(action))) {
    return NextResponse.json(
      {
        error: "This action is incompatible with current mission state.",
        erro: "Invalid transition.",
      },
      { status: 409 },
    );
  }

  const isInspector = session.role === "admin";
  const isSpokesperson =
    String(session.role) === "spokesperson" ||
    String(session.role) === "voz" ||
    String(session.role) === "admin";

  let r: { ok: true } | { ok: false; error: string; erro?: string };

  switch (action) {
    case "approve": {
      if (!isInspector && !isSpokesperson) {
        return NextResponse.json(
          {
            error: "Only spokespersons or quality inspectors may approve deliverables.",
            erro: "Unauthorized.",
          },
          { status: 403 },
        );
      }
      const asOwner = !isInspector;
      const rating =
        typeof body?.rating === "number"
          ? body.rating
          : typeof body?.nota === "number"
            ? body.nota
            : undefined;
      const feedback =
        typeof body?.feedback === "string"
          ? body.feedback
          : typeof body?.comentario === "string"
            ? body.comentario
            : undefined;
      r = await approveMission(
        missionId,
        session.id,
        rating,
        feedback,
        asOwner ? session.id : undefined,
      );
      break;
    }

    case "message": {
      const text = body?.text ?? body?.texto;
      if (typeof text !== "string" || !text.trim()) {
        return NextResponse.json(
          { error: "Message content cannot be empty.", erro: "Message empty." },
          { status: 400 },
        );
      }
      r = await sendMessage(missionId, session, text.trim());
      break;
    }

    case "report": {
      const text = body?.text ?? body?.texto;
      if (typeof text !== "string" || !text.trim()) {
        return NextResponse.json(
          { error: "Please describe the issue report.", erro: "Report empty." },
          { status: 400 },
        );
      }
      r = await createModerationReport(missionId, session, text.trim());
      break;
    }

    default:
      return NextResponse.json(
        { error: "Unknown action handler.", erro: "Unknown action." },
        { status: 400 },
      );
  }

  if (!r.ok)
    return NextResponse.json(
      { error: r.error ?? r.erro, erro: r.error ?? r.erro },
      { status: 409 },
    );

  // Enfileirar é rápido e precisa acontecer; entregar fica para depois da
  // resposta (vira waitUntil nos Workers).
  await dispatchNotifications(action, missionId, new URL(request.url).origin, body).catch((e) =>
    console.error("[notification] failed after action", action, e),
  );
  after(drainEmailQueueNow);

  return NextResponse.json({ ok: true });
}

async function dispatchNotifications(
  action: string,
  missionId: number,
  origin: string,
  body: Record<string, unknown> | null,
): Promise<void> {
  const c = await missionContacts(missionId);
  if (!c) return;

  const editorUrl = `${origin}/editor`;

  if (action === "approve" && c.editor) {
    const rating =
      typeof body?.rating === "number"
        ? body.rating
        : typeof body?.nota === "number"
          ? body.nota
          : undefined;
    await queueMissionNotification(
      "aprovacao",
      missionId,
      c.editor.email,
      buildApprovedDeliveryEmail(c.editor.name, c.title, rating, editorUrl),
    );
  }
}
