import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { buildAuthorizeUrl, generatePkce, generateState } from "@/lib/auth/x-oauth";

export const runtime = "nodejs";

export async function GET() {
  if (!env.X_CLIENT_ID) {
    return NextResponse.redirect(new URL("/login?error=x_not_configured", env.APP_URL));
  }

  const { codeVerifier, codeChallenge } = generatePkce();
  const state = generateState();

  const store = await cookies();
  const cookieOpts = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10, // 10 minutes to complete the flow
  };
  store.set("x_oauth_state", state, cookieOpts);
  store.set("x_oauth_verifier", codeVerifier, cookieOpts);

  return NextResponse.redirect(buildAuthorizeUrl({ state, codeChallenge }));
}
