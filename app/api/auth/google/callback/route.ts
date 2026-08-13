import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { trocarCodigoPorPerfil } from "@/lib/oauth-google";
import { buscarContaGoogle } from "@/lib/contas";
import {
  COOKIE_ESTADO_OPTS,
  COOKIE_OPTS,
  criarIdentidadePendente,
  criarTokenSessao,
  NOME_COOKIE,
  NOME_COOKIE_ESTADO,
  NOME_COOKIE_PENDENTE,
  verificarEstadoAssinado,
} from "@/lib/sessao";

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

  const jar = await cookies();

  // o nonce do cookie tem que bater com o que veio dentro do state. Some depois
  // de conferido, valendo uma vez só: se o `code` vazar num log ou no histórico,
  // reapresentá-lo não reabre o fluxo.
  const nonce = jar.get(NOME_COOKIE_ESTADO)?.value;
  const estadoOk = await verificarEstadoAssinado(stateToken, nonce);
  jar.delete(NOME_COOKIE_ESTADO);
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
    jar.set(NOME_COOKIE, token, COOKIE_OPTS);
    const destino = resultado.conta.papel === "editor" ? "/editor" : "/porta-voz";
    return NextResponse.redirect(new URL(destino, url.origin));
  }

  // identidade nova — ainda não sabemos se é editor ou porta-voz. Carrega o
  // que o Google confirmou num token de curta duração e manda escolher.
  //
  // Vai em cookie, não na query string. Este token cria uma conta com o e-mail
  // e o googleId que o Google acabou de confirmar: quem o tiver, vira essa
  // pessoa aqui dentro. Na URL ele ficava no histórico do navegador, no
  // Referer de qualquer coisa carregada na página e nos logs de acesso.
  const pendente = await criarIdentidadePendente({
    googleId: perfilGoogle.googleId,
    email: perfilGoogle.email,
    nome: perfilGoogle.nome,
    foto: perfilGoogle.foto,
  });
  jar.set(NOME_COOKIE_PENDENTE, pendente, COOKIE_ESTADO_OPTS);
  return NextResponse.redirect(new URL("/escolher-papel", url.origin));
}
