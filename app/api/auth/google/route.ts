import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isGoogleOAuthConfigured, buildGoogleAuthUrl } from "@/lib/oauth-google";
import { STATE_COOKIE_OPTS, createSignedState, STATE_COOKIE_NAME } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth is not configured yet (missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).", erro: "Google OAuth not configured." },
      { status: 503 }
    );
  }

  const redirectUri = new URL("/api/auth/google/callback", url.origin).toString();

  const nonce = crypto.randomUUID();
  const state = await createSignedState(nonce);

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE_NAME, nonce, STATE_COOKIE_OPTS);

  return NextResponse.redirect(buildGoogleAuthUrl(redirectUri, state));
}
