import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createGoogleAccount, checkRoleSlots } from "@/lib/accounts";
import {
  COOKIE_OPTS,
  createSessionToken,
  COOKIE_NAME,
  PENDING_COOKIE_NAME,
  INVITATION_COOKIE_NAME,
  REFERRAL_COOKIE_NAME,
  verifyPendingIdentity,
  type Role,
} from "@/lib/session";
import { recordDailyLogin } from "@/lib/gamification-db";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rawRole = body?.role ?? body?.papel;

  const role: Role = rawRole === "spokesperson" || rawRole === "voz" ? "spokesperson" : rawRole === "editor" ? "editor" : "editor";

  if (rawRole !== "editor" && rawRole !== "spokesperson" && rawRole !== "voz") {
    return NextResponse.json({ error: "Choose whether you are an editor or spokesperson.", erro: "Choose whether you are an editor or spokesperson." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_COOKIE_NAME)?.value;
  const pending = token ? await verifyPendingIdentity(token) : null;
  if (!pending) {
    return NextResponse.json({ error: "Session expired, please try again.", erro: "Session expired, please try again." }, { status: 400 });
  }

  const slotCheck = await checkRoleSlots(role);
  if (!slotCheck.ok) {
    cookieStore.delete(PENDING_COOKIE_NAME);
    return NextResponse.json({ error: slotCheck.error, erro: slotCheck.error }, { status: 403 });
  }

  const invitation = cookieStore.get(INVITATION_COOKIE_NAME)?.value;
  const referralCode = cookieStore.get(REFERRAL_COOKIE_NAME)?.value;

  const result = await createGoogleAccount({ ...pending, role, invitation, referralCode });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, erro: result.error }, { status: 400 });
  }

  cookieStore.delete(PENDING_COOKIE_NAME);
  cookieStore.delete(INVITATION_COOKIE_NAME);
  cookieStore.delete(REFERRAL_COOKIE_NAME);

  const sessionToken = await createSessionToken(result.account);
  cookieStore.set(COOKIE_NAME, sessionToken, COOKIE_OPTS);
  void recordDailyLogin(result.account.id).catch((e) =>
    console.error("[gamification] failed to record login", e)
  );

  const destination = role === "editor" ? "/editor/criar-perfil" : "/porta-voz/criar-perfil?via=google";
  return NextResponse.json({ ok: true, destination, destino: destination });
}
