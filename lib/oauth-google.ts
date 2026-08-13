const AUTORIZAR_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

function credenciais() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function googleConfigurado() {
  return credenciais() !== null;
}

export function montarUrlAutorizacao(redirectUri: string, state: string) {
  const c = credenciais();
  if (!c) throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configurados (.env.local)");

  const params = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTORIZAR_URL}?${params.toString()}`;
}

export type PerfilGoogle = { googleId: string; email: string; nome: string; foto?: string };

export async function trocarCodigoPorPerfil(
  code: string,
  redirectUri: string
): Promise<PerfilGoogle | null> {
  const c = credenciais();
  if (!c) return null;

  const respToken = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!respToken.ok) return null;
  const { access_token } = (await respToken.json()) as { access_token?: string };
  if (!access_token) return null;

  const respPerfil = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!respPerfil.ok) return null;
  const perfil = (await respPerfil.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
  if (!perfil.sub || !perfil.email) return null;

  // E-mail não confirmado pelo Google não vale como prova de identidade. Isso
  // passou a importar quando entrar com o Google virou caminho pra recuperar
  // conta: sem esta linha, bastaria alguém abrir uma conta Google com o e-mail
  // de outra pessoa, sem confirmar nada, pra entrar na conta dela aqui dentro.
  if (perfil.email_verified === false) return null;

  return {
    googleId: perfil.sub,
    email: perfil.email,
    nome: perfil.name ?? perfil.email,
    foto: perfil.picture,
  };
}
