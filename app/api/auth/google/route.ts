import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { googleConfigurado, montarUrlAutorizacao } from "@/lib/oauth-google";
import { COOKIE_ESTADO_OPTS, criarEstadoAssinado, NOME_COOKIE_ESTADO } from "@/lib/sessao";

// não pergunta mais o papel aqui — quem já tem conta entra direto no papel
// que já tem, e quem é novo escolhe depois, em /escolher-papel (ver callback)
export async function GET(request: Request) {
  const url = new URL(request.url);

  if (!googleConfigurado()) {
    return NextResponse.json(
      { erro: "Login com Google ainda não configurado (faltam GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET no .env.local)." },
      { status: 503 }
    );
  }

  const redirectUri = new URL("/api/auth/google/callback", url.origin).toString();

  // o nonce vai em dois lugares: dentro do state (que viaja pelo Google, à
  // vista) e num cookie httpOnly (que fica só neste navegador). O callback só
  // aceita se os dois baterem — é isso que amarra o fluxo a quem o começou.
  const nonce = crypto.randomUUID();
  const state = await criarEstadoAssinado(nonce);

  const jar = await cookies();
  jar.set(NOME_COOKIE_ESTADO, nonce, COOKIE_ESTADO_OPTS);

  return NextResponse.redirect(montarUrlAutorizacao(redirectUri, state));
}
