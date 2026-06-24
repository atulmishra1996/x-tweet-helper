import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { destroySession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  await destroySession();
  return NextResponse.json({ data: { ok: true } });
}

export async function GET() {
  await destroySession();
  return NextResponse.redirect(new URL("/login", env.APP_URL));
}
