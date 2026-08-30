import { COOKIE_NAME, COOKIE_OPTS, createSessionToken, type Role } from "@oficina/auth/session";
import { isDevAuthBypassEnabled } from "@oficina/config/dev-mode";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const DEV_ACCOUNTS: Record<
  Role,
  { id: number; handle: string; name: string; email: string; destination: string }
> = {
  editor: {
    id: 9001,
    handle: "dev.editor",
    name: "Dev Editor de Vídeo",
    email: "dev.editor@oficinaamarela.local",
    destination: "/editor",
  },
  spokesperson: {
    id: 9002,
    handle: "dev.porta-voz",
    name: "Dev Porta-Voz",
    email: "dev.porta-voz@oficinaamarela.local",
    destination: "/porta-voz",
  },
  admin: {
    id: 9003,
    handle: "dev.admin",
    name: "Dev Inspetor",
    email: "dev.admin@oficinaamarela.local",
    destination: "/inspetor",
  },
};

export async function GET(request: Request) {
  if (!isDevAuthBypassEnabled()) {
    return NextResponse.json(
      { error: "Route available in development mode only.", erro: "Dev only." },
      { status: 404 },
    );
  }

  const url = new URL(request.url);
  const rawRole = url.searchParams.get("role") ?? url.searchParams.get("papel");
  const role: Role =
    rawRole === "spokesperson" || rawRole === "voz"
      ? "spokesperson"
      : rawRole === "admin"
        ? "admin"
        : "editor";

  const acc = DEV_ACCOUNTS[role];
  const targetParam = url.searchParams.get("destination") ?? url.searchParams.get("destino");
  const destination =
    targetParam === "profile" || targetParam === "perfil"
      ? role === "editor"
        ? "/editor/criar-perfil"
        : role === "spokesperson"
          ? "/porta-voz/criar-perfil"
          : acc.destination
      : acc.destination;

  const token = await createSessionToken({
    id: acc.id,
    handle: acc.handle,
    name: acc.name,
    role,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTS);

  return NextResponse.redirect(new URL(destination, url.origin));
}
