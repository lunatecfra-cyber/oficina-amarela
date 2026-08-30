import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { COOKIE_NAME, COOKIE_OPTS, createSessionToken, type Role } from "@/lib/session";

function isDevEnvironment() {
  return process.env.NODE_ENV === "development" && !process.env.VERCEL;
}

const DEV_ACCOUNTS: Record<
  Role,
  { handle: string; name: string; email: string; destination: string }
> = {
  editor: {
    handle: "dev.editor",
    name: "Dev Editor de Vídeo",
    email: "dev.editor@oficinaamarela.local",
    destination: "/editor",
  },
  spokesperson: {
    handle: "dev.porta-voz",
    name: "Dev Porta-Voz",
    email: "dev.porta-voz@oficinaamarela.local",
    destination: "/porta-voz",
  },
  admin: {
    handle: "dev.admin",
    name: "Dev Inspetor",
    email: "dev.admin@oficinaamarela.local",
    destination: "/inspetor",
  },
};

export async function GET(request: Request) {
  if (!isDevEnvironment()) {
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

  const dbPapel = role === "spokesperson" ? "voz" : role;

  const [row] = await sql`
    INSERT INTO users (apelido, nome, email, papel)
    VALUES (${acc.handle}, ${acc.name}, ${acc.email}, ${dbPapel})
    ON CONFLICT (lower(apelido)) DO UPDATE SET nome = EXCLUDED.nome
    RETURNING id, apelido, nome, papel
  `;

  const session = row
    ? {
        id: row.id,
        handle: row.apelido,
        name: row.nome,
        role,
      }
    : {
        id: 9000 + (role === "editor" ? 1 : role === "spokesperson" ? 2 : 3),
        handle: acc.handle,
        name: acc.name,
        role,
      };

  const token = await createSessionToken({
    id: session.id,
    handle: session.handle,
    name: session.name,
    role: session.role,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTS);

  return NextResponse.redirect(new URL(destination, url.origin));
}
