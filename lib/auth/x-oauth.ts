import { createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * X (Twitter) OAuth 2.0 Authorization Code Flow with PKCE.
 * Docs: https://docs.x.com/resources/fundamentals/authentication/oauth-2-0/authorization-code
 */

export const X_SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access"];

const AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generatePkce() {
  const codeVerifier = base64url(randomBytes(48));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

export function generateState(): string {
  return base64url(randomBytes(24));
}

export function buildAuthorizeUrl(params: { state: string; codeChallenge: string }): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.X_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", env.X_CALLBACK_URL);
  url.searchParams.set("scope", X_SCOPES.join(" "));
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

function basicAuthHeader(): Record<string, string> {
  if (env.X_CLIENT_SECRET) {
    const creds = Buffer.from(`${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`).toString("base64");
    return { Authorization: `Basic ${creds}` };
  }
  return {};
}

export async function exchangeCode(code: string, codeVerifier: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.X_CALLBACK_URL,
    code_verifier: codeVerifier,
    client_id: env.X_CLIENT_ID ?? "",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...basicAuthHeader() },
    body,
  });
  if (!res.ok) {
    throw new Error(`X token exchange failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.X_CLIENT_ID ?? "",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...basicAuthHeader() },
    body,
  });
  if (!res.ok) {
    throw new Error(`X token refresh failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}
