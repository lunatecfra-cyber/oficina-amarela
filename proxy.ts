import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";

export default async function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === "development" && request.cookies.get("dev_god_mode")?.value === "true") {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (process.env.NODE_ENV === "development" && !process.env.VERCEL) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const pathname = request.nextUrl.pathname;
  // as rotas públicas são em PT-BR: mandar pra "/spokesperson" dava 404
  const defaultArea = session.role === "spokesperson" ? "/porta-voz" : "/editor";

  // Inspector / Admin protected area
  if (pathname.startsWith("/inspector") || pathname.startsWith("/inspetor") || pathname.startsWith("/admin")) {
    if (session.role !== "admin") {
      return NextResponse.redirect(new URL(defaultArea, request.url));
    }
    return NextResponse.next();
  }

  // Role enforcement
  const isSpokespersonRoute = pathname.startsWith("/spokesperson") || pathname.startsWith("/porta-voz");
  const requiredRole = isSpokespersonRoute ? "spokesperson" : "editor";

  if (session.role !== "admin" && session.role !== requiredRole) {
    return NextResponse.redirect(new URL(defaultArea, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/spokesperson/:path*",
    "/porta-voz/:path*",
    "/editor/:path*",
    "/profile/:path*",
    "/perfil/:path*",
    "/inspector/:path*",
    "/inspetor/:path*",
    "/admin/:path*",
    "/schedule/:path*",
    "/agenda/:path*",
    "/leaderboard/:path*",
    "/ranking/:path*",
    "/lessons/:path*",
    "/aulas/:path*",
    "/tools/:path*",
    "/ferramentas/:path*",
  ],
};
