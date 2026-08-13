import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { trocarCodigoPorPerfil } from "@/lib/oauth-google";
import { buscarContaGoogle } from "@/lib/contas";
import { criarIdentidadePendente, criarTokenSessao, verificarEstadoAssinado, NOME_COOKIE, COOKIE_OPTS } from "@/lib/sessao";

function erroRedirect(origin: string, motivo: string) {
  return NextResponse.redirect(`${origin}/login?erro_google=${encodeURIComponent(motivo)}`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateToken = url.searchParams.get("state");

  if (!code || !stateToken) {
    return erroRedirect(url.origin, "Login com Google cancelado.");
  }

  const estadoOk = await verificarEstadoAssinado(stateToken);
  if (!estadoOk) {
    return erroRedirect(url.origin, "Sessão de login expirou, tenta de novo.");
  }

  const redirectUri = new URL("/api/auth/google/callback", url.origin).toString();
  const perfilGoogle = await trocarCodigoPorPerfil(code, redirectUri);
  if (!perfilGoogle) {
    return erroRedirect(url.origin, "Não deu pra confirmar sua conta Google.");
  }

  const resultado = await buscarContaGoogle(perfilGoogle.googleId, perfilGoogle.email);
  if (!resultado.ok) {
    return erroRedirect(url.origin, resultado.erro);
  }

  // conta já existe: entra direto no papel que ela já tem — nunca se
  // pergunta de novo, então não tem como cair no papel errado
  if (resultado.conta) {
    const token = await criarTokenSessao(resultado.conta);
    const jar = await cookies();
    jar.set(NOME_COOKIE, token, COOKIE_OPTS);
    const destino = resultado.conta.papel === "editor" ? "/editor" : "/porta-voz";
    return NextResponse.redirect(new URL(destino, url.origin));
  }

  // identidade nova — ainda não sabemos se é editor ou porta-voz. Carrega o
  // que o Google confirmou num token de curta duração e manda escolher.
  const pendente = await criarIdentidadePendente({
    googleId: perfilGoogle.googleId,
    email: perfilGoogle.email,
    nome: perfilGoogle.nome,
    foto: perfilGoogle.foto,
  });
  return NextResponse.redirect(new URL(`/escolher-papel?t=${pendente}`, url.origin));
}
