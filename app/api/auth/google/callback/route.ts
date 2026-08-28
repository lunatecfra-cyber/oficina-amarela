import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForProfile } from "@/lib/oauth-google";
import { findGoogleAccount } from "@/lib/accounts";
import {
  STATE_COOKIE_OPTS,
  COOKIE_OPTS,
  createPendingIdentity,
  createSessionToken,
  COOKIE_NAME,
  STATE_COOKIE_NAME,
  PENDING_COOKIE_NAME,
  verifySignedState,
} from "@/lib/session";

function errorRedirect(origin: string, reason: string) {
  return NextResponse.redirect(`${origin}/login?google_error=${encodeURIComponent(reason)}`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateToken = url.searchParams.get("state");

  if (!code || !stateToken) {
    return errorRedirect(url.origin, "Google sign-in was cancelled.");
  }

  const cookieStore = await cookies();

  const nonce = cookieStore.get(STATE_COOKIE_NAME)?.value;
  const isStateValid = await verifySignedState(stateToken, nonce);
  cookieStore.delete(STATE_COOKIE_NAME);
  if (!isStateValid) {
    return errorRedirect(url.origin, "Sign-in session expired, please try again.");
  }

  const redirectUri = new URL("/api/auth/google/callback", url.origin).toString();
  const googleProfile = await exchangeCodeForProfile(code, redirectUri);
  if (!googleProfile) {
    return errorRedirect(url.origin, "Could not confirm Google account identity.");
  }

  const result = await findGoogleAccount(googleProfile.googleId, googleProfile.email);
  if (!result.ok) {
    return errorRedirect(url.origin, result.error);
  }

  if (result.account) {
    const token = await createSessionToken(result.account);
    cookieStore.set(COOKIE_NAME, token, COOKIE_OPTS);
    const destination = result.account.role === "editor" ? "/editor" : "/spokesperson";
    return NextResponse.redirect(new URL(destination, url.origin));
  }

  const pendingToken = await createPendingIdentity({
    googleId: googleProfile.googleId,
    email: googleProfile.email,
    name: googleProfile.name,
    picture: googleProfile.picture,
  });
  cookieStore.set(PENDING_COOKIE_NAME, pendingToken, STATE_COOKIE_OPTS);
  return NextResponse.redirect(new URL("/choose-role", url.origin));
}
