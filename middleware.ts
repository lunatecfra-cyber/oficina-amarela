import { NextRequest, NextResponse } from "next/server";
import { verificarTokenSessao, NOME_COOKIE } from "@/lib/sessao";

export default async function middleware(request: NextRequest) {
  const token = request.cookies.get(NOME_COOKIE)?.value;
  const sessao = token ? await verificarTokenSessao(token) : null;

  if (!sessao) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const caminho = request.nextUrl.pathname;
  const areaDoPapel = sessao.papel === "voz" ? "/porta-voz" : "/editor";

  // /inspetor era totalmente aberto — agora só admin entra. Quando existir um
  // papel "inspetor" de verdade no banco, ele entra nessa condição também.
  if (caminho.startsWith("/inspetor")) {
    if (sessao.papel !== "admin") {
      return NextResponse.redirect(new URL(areaDoPapel, request.url));
    }
    return NextResponse.next();
  }

  // resto das rotas protegidas (/editor, /perfil, /agenda, /aulas, /ranking)
  // é área de editor; /porta-voz é do candidato
  const rotaExigePapel = caminho.startsWith("/porta-voz") ? "voz" : "editor";

  if (sessao.papel !== "admin" && sessao.papel !== rotaExigePapel) {
    return NextResponse.redirect(new URL(areaDoPapel, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/porta-voz/:path*",
    "/editor/:path*",
    "/perfil/:path*",
    "/inspetor/:path*",
    "/agenda/:path*",
    "/ranking/:path*",
    "/aulas/:path*",
  ],
};
