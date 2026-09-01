const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

function credentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isGoogleConfigured() {
  return credentials() !== null;
}

export function buildAuthorizationUrl(redirectUri: string, state: string) {
  const c = credentials();
  if (!c) throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are not configured (.env.local)");

  const params = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export type GoogleProfile = {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  // aliases
  nome?: string;
  foto?: string;
};

export type PerfilGoogle = GoogleProfile;

export async function exchangeCodeForProfile(
  code: string,
  redirectUri: string,
): Promise<GoogleProfile | null> {
  const c = credentials();
  if (!c) return null;

  const tokenResp = await fetch(TOKEN_URL, {
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
  if (!tokenResp.ok) return null;
  const { access_token } = (await tokenResp.json()) as { access_token?: string };
  if (!access_token) return null;

  const profileResp = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!profileResp.ok) return null;
  const profile = (await profileResp.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
  if (!profile.sub || !profile.email) return null;
  if (profile.email_verified === false) return null;

  return {
    googleId: profile.sub,
    email: profile.email,
    name: profile.name ?? profile.email,
    picture: profile.picture,
    nome: profile.name ?? profile.email,
    foto: profile.picture,
  };
}
