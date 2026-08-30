import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildGoogleAuthUrl, isGoogleOAuthConfigured } from "@/lib/oauth-google";
import {
  createSignedState,
  INVITATION_COOKIE_NAME,
  REFERRAL_COOKIE_NAME,
  STATE_COOKIE_NAME,
  STATE_COOKIE_OPTS,
} from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Google OAuth is not configured yet (missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
        erro: "Google OAuth not configured.",
      },
      { status: 503 },
    );
  }

  const redirectUri = new URL("/api/auth/google/callback", url.origin).toString();

  const nonce = crypto.randomUUID();
  const state = await createSignedState(nonce);

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE_NAME, nonce, STATE_COOKIE_OPTS);

  const invitation = url.searchParams.get("convite") ?? url.searchParams.get("invitation");
  if (invitation) cookieStore.set(INVITATION_COOKIE_NAME, invitation, STATE_COOKIE_OPTS);
  else cookieStore.delete(INVITATION_COOKIE_NAME);

  const referral = url.searchParams.get("indicacao") ?? url.searchParams.get("referral");
  if (referral) cookieStore.set(REFERRAL_COOKIE_NAME, referral, STATE_COOKIE_OPTS);
  else cookieStore.delete(REFERRAL_COOKIE_NAME);

  return NextResponse.redirect(buildGoogleAuthUrl(redirectUri, state));
}
