import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAccount, checkRoleSlots, recordAttempt, isRateLimited } from "@/lib/accounts";
import { requestIpAddress } from "@/lib/ip";
import { createSessionToken, COOKIE_NAME, COOKIE_OPTS, type Role } from "@/lib/session";
import { recordDailyLogin } from "@/lib/gamification-db";

const MAX_SIGNUPS_PER_IP = 10;

export async function POST(request: Request) {
  const ip = requestIpAddress(request);
  const key = `signup:${ip}`;
  const lock = await isRateLimited(key);
  if (lock.locked) {
    return NextResponse.json(
      {
        error: `Muitas contas criadas deste IP. Tente novamente em ${lock.minutes} min.`,
        erro: `Muitas contas criadas deste IP. Tente novamente em ${lock.minutes} min.`,
      },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const name = body?.name ?? body?.nome;
  const handle = body?.handle ?? body?.apelido;
  const email = body?.email;
  const password = body?.password ?? body?.senha;
  const rawRole = body?.role ?? body?.papel;
  const invitation = typeof body?.invitation === "string" ? body.invitation : typeof body?.convite === "string" ? body.convite : undefined;
  const referralCode = typeof body?.referralCode === "string" ? body.referralCode : typeof body?.codigoIndicacao === "string" ? body.codigoIndicacao : undefined;

  const role: Role = rawRole === "spokesperson" || rawRole === "voz" ? "spokesperson" : rawRole === "editor" ? "editor" : "editor";

  if (
    typeof name !== "string" ||
    typeof handle !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return NextResponse.json({ error: "Preencha todos os campos obrigatórios.", erro: "Preencha todos os campos obrigatórios." }, { status: 400 });
  }

  if (rawRole !== "spokesperson" && rawRole !== "voz" && rawRole !== "editor") {
    return NextResponse.json({ error: "Escolha se você é candidato ou editor.", erro: "Escolha se você é candidato ou editor." }, { status: 400 });
  }

  const slotCheck = await checkRoleSlots(role);
  if (!slotCheck.ok) {
    return NextResponse.json({ error: slotCheck.error, erro: slotCheck.error }, { status: 403 });
  }

  const result = await createAccount({
    name,
    handle,
    email,
    password,
    role,
    invitation,
    referralCode,
  });

  if (!result.ok) {
    if (result.conflict) {
      await recordAttempt(key, MAX_SIGNUPS_PER_IP);
    }
    return NextResponse.json(
      { error: result.error, erro: result.error },
      { status: result.conflict ? 409 : 400 }
    );
  }

  await recordAttempt(key, MAX_SIGNUPS_PER_IP);

  const token = await createSessionToken(result.account);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTS);
  void recordDailyLogin(result.account.id).catch((e) =>
    console.error("[gamification] failed to record login", e)
  );

  return NextResponse.json({ ok: true, ...result.account });
}
