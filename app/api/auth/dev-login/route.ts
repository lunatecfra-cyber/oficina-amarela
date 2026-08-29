import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { createSessionToken, COOKIE_NAME, COOKIE_OPTS, type Role } from "@/lib/session";

function isDevEnvironment() {
  return process.env.NODE_ENV === "development" && !process.env.VERCEL;
}

const DEV_ACCOUNTS: Record<Role, { handle: string; name: string; email: string; destination: string }> = {
  editor: {
    handle: "dev.editor",
    name: "Dev Video Editor",
    email: "dev.editor@yellowworkshop.local",
    destination: "/editor",
  },
  spokesperson: {
    handle: "dev.spokesperson",
    name: "Dev Spokesperson",
    email: "dev.spokesperson@yellowworkshop.local",
    destination: "/spokesperson",
  },
  admin: {
    handle: "dev.admin",
    name: "Dev Inspector",
    email: "dev.admin@yellowworkshop.local",
    destination: "/inspector",
  },
};

export async function GET(request: Request) {
  if (!isDevEnvironment()) {
    return NextResponse.json({ error: "Route available in development mode only.", erro: "Dev only." }, { status: 404 });
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
        ? "/editor/create-profile"
        : role === "spokesperson"
          ? "/spokesperson/create-profile"
          : acc.destination
      : acc.destination;

  const [row] = await sql`
    INSERT INTO users (handle, name, email, role)
    VALUES (${acc.handle}, ${acc.name}, ${acc.email}, ${role})
    ON CONFLICT (lower(handle)) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, handle, name, role
  `;

  const session = row ?? {
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
