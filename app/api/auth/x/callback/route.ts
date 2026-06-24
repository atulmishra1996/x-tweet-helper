import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { db } from "@/lib/db/client";
import { users, settings as settingsTable, auditLog } from "@/lib/db/schema";
import { encrypt, safeEqual } from "@/lib/crypto";
import { exchangeCode, X_SCOPES } from "@/lib/auth/x-oauth";
import { createSession } from "@/lib/auth/session";
import { scoped } from "@/lib/logger";

export const runtime = "nodejs";

const log = scoped("auth");

interface XUserResponse {
  data: {
    id: string;
    username: string;
    name: string;
    profile_image_url?: string;
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) return NextResponse.redirect(new URL(`/login?error=${error}`, env.APP_URL));
  if (!code || !state) return NextResponse.redirect(new URL("/login?error=missing_params", env.APP_URL));

  const store = await cookies();
  const savedState = store.get("x_oauth_state")?.value;
  const verifier = store.get("x_oauth_verifier")?.value;
  store.delete("x_oauth_state");
  store.delete("x_oauth_verifier");

  if (!savedState || !verifier || !safeEqual(state, savedState)) {
    return NextResponse.redirect(new URL("/login?error=state_mismatch", env.APP_URL));
  }

  try {
    const tokens = await exchangeCode(code, verifier);

    const meRes = await fetch(
      "https://api.x.com/2/users/me?user.fields=profile_image_url,public_metrics",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    if (!meRes.ok) throw new Error(`Failed to fetch X profile (${meRes.status})`);
    const me = (await meRes.json()) as XUserResponse;

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const values = {
      xUserId: me.data.id,
      handle: me.data.username,
      displayName: me.data.name,
      avatarUrl: me.data.profile_image_url ?? null,
      accessToken: encrypt(tokens.access_token),
      refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      tokenExpiresAt: expiresAt,
      scopes: tokens.scope ?? X_SCOPES.join(" "),
      updatedAt: new Date(),
    };

    const [user] = await db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({ target: users.xUserId, set: values })
      .returning();

    await db
      .insert(settingsTable)
      .values({ userId: user.id })
      .onConflictDoNothing({ target: settingsTable.userId });

    await db.insert(auditLog).values({ userId: user.id, action: "auth.login", entity: "x" });

    await createSession(user.id);
    return NextResponse.redirect(new URL("/", env.APP_URL));
  } catch (err) {
    log.error({ err }, "OAuth callback failed");
    return NextResponse.redirect(new URL("/login?error=oauth_failed", env.APP_URL));
  }
}
