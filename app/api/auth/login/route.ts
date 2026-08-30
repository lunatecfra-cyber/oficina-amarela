import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  authenticateUser,
  clearLoginAttempts,
  isLoginLockedByHandle,
  isLoginLockedByIp,
  recordLoginFailure,
  recordLoginFailureByIp,
} from "@/lib/accounts";
import { recordDailyLogin } from "@/lib/gamification-db";
import { requestIpAddress } from "@/lib/ip";
import { COOKIE_NAME, COOKIE_OPTS, createSessionToken } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const handle = body?.handle ?? body?.apelido;
  const password = body?.password ?? body?.senha;

  if (typeof handle !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "Digite seu apelido e senha.", erro: "Digite seu apelido e senha." },
      { status: 400 },
    );
  }

  const ip = requestIpAddress(request);

  const lockHandle = await isLoginLockedByHandle(handle);
  const lockIp = await isLoginLockedByIp(ip);
  if (lockHandle.locked || lockIp.locked) {
    const minutes = Math.max(lockHandle.minutes, lockIp.minutes);
    return NextResponse.json(
      {
        error: `Muitas tentativas. Tente novamente em ${minutes} min.`,
        erro: `Muitas tentativas. Tente novamente em ${minutes} min.`,
      },
      { status: 429 },
    );
  }

  const result = await authenticateUser(handle, password);
  if (!result.ok) {
    await recordLoginFailure(handle);
    await recordLoginFailureByIp(ip);
    return NextResponse.json({ error: result.error, erro: result.error }, { status: 401 });
  }

  await clearLoginAttempts(handle);

  const token = await createSessionToken(result.account);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTS);
  void recordDailyLogin(result.account.id).catch((e) =>
    console.error("[gamification] failed to record login", e),
  );

  return NextResponse.json({ ok: true, ...result.account });
}
