import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { publishDuePosts } from "@/lib/services/posting";
import { syncAllMetrics } from "@/lib/services/metric-sync";
import { syncAllGrowth } from "@/lib/services/growth-sync";
import { buildAllRecaps } from "@/lib/services/recap";
import { scoped } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = scoped("cron");

/**
 * Serverless cron entrypoint (Vercel Cron or any scheduler). Protect with
 * CRON_SECRET: callers must send `Authorization: Bearer <CRON_SECRET>`.
 * Tasks: scheduled | metric-sync | growth-sync | recap.
 */
type Ctx = { params: Promise<{ task: string }> };

function authorized(req: Request): boolean {
  if (!env.CRON_SECRET) return env.NODE_ENV !== "production"; // allow in dev only
  return req.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}

export async function GET(req: Request, ctx: Ctx) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { task } = await ctx.params;
  log.info({ task }, "Cron task triggered");

  try {
    switch (task) {
      case "scheduled": {
        const published = await publishDuePosts();
        return NextResponse.json({ ok: true, published });
      }
      case "metric-sync":
        await syncAllMetrics();
        return NextResponse.json({ ok: true });
      case "growth-sync":
        await syncAllGrowth();
        return NextResponse.json({ ok: true });
      case "recap":
        await buildAllRecaps();
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "unknown task" }, { status: 404 });
    }
  } catch (err) {
    log.error({ err, task }, "Cron task failed");
    return NextResponse.json({ error: "task failed" }, { status: 500 });
  }
}
