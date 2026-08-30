import {
  COOKIE_NAME,
  COOKIE_OPTS,
  createSessionToken,
  INVITATION_COOKIE_NAME,
  PENDING_COOKIE_NAME,
  REFERRAL_COOKIE_NAME,
  type Role,
  verifyPendingIdentity,
} from "@oficina/auth/session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { fetchApi } from "@/lib/internal-api";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rawRole = body?.role ?? body?.papel;

  const role: Role =
    rawRole === "spokesperson" || rawRole === "voz"
      ? "spokesperson"
      : rawRole === "editor"
        ? "editor"
        : "editor";

  if (rawRole !== "editor" && rawRole !== "spokesperson" && rawRole !== "voz") {
    return NextResponse.json(
      {
        error: "Escolha se você é candidato ou editor.",
        erro: "Escolha se você é candidato ou editor.",
      },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_COOKIE_NAME)?.value;
  const pending = token ? await verifyPendingIdentity(token) : null;
  if (!pending) {
    return NextResponse.json(
      { error: "Sessão expirada, tente novamente.", erro: "Sessão expirada, tente novamente." },
      { status: 400 },
    );
  }

  const invitation = cookieStore.get(INVITATION_COOKIE_NAME)?.value;
  const referralCode = cookieStore.get(REFERRAL_COOKIE_NAME)?.value;

  const res = await fetchApi("/auth/google/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...pending,
      role,
      invitation,
      referralCode,
    }),
  });

  const result = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    id?: number;
    handle?: string;
    name?: string;
    email?: string;
    role?: Role;
  };

  if (!res.ok || !result.ok) {
    if (res.status === 403) cookieStore.delete(PENDING_COOKIE_NAME);
    return NextResponse.json({ error: result.error, erro: result.error }, { status: res.status });
  }

  cookieStore.delete(PENDING_COOKIE_NAME);
  cookieStore.delete(INVITATION_COOKIE_NAME);
  cookieStore.delete(REFERRAL_COOKIE_NAME);

  const sessionToken = await createSessionToken({
    id: Number(result.id),
    handle: String(result.handle),
    name: String(result.name),
    role: (result.role ?? role) as Role,
  });
  cookieStore.set(COOKIE_NAME, sessionToken, COOKIE_OPTS);

  const destination =
    role === "editor" ? "/editor/criar-perfil" : "/porta-voz/criar-perfil?via=google";
  return NextResponse.json({ ok: true, destination, destino: destination });
}
