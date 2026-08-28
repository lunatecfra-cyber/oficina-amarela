import { NextResponse } from "next/server";
import { updateAccountPassword, isRecoveryTokenAlreadyUsed } from "@/lib/accounts";
import { verifyRecoveryToken } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = body?.token;
  const password = body?.password ?? body?.senha;

  if (typeof token !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Please fill in new password.", erro: "Please fill in new password." }, { status: 400 });
  }

  const data = await verifyRecoveryToken(token);
  if (!data) {
    return NextResponse.json({ error: "Link expired or invalid. Please request a new link.", erro: "Link expired or invalid." }, { status: 401 });
  }

  if (await isRecoveryTokenAlreadyUsed(data.userId, data.issuedAtMs)) {
    return NextResponse.json({ error: "Link expired or already used. Please request a new link.", erro: "Link expired or already used." }, { status: 401 });
  }

  const result = await updateAccountPassword(data.userId, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, erro: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
