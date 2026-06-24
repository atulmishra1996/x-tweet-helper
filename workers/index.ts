/**
 * Background worker process. Run with `npm run worker` (separate from the web
 * app). Handles scheduled posting and recurring metric/growth/recap syncs.
 *
 * Uses pg-boss (Postgres-backed) so no Redis is required.
 */
import "dotenv/config";
import { getBoss, QUEUES } from "@/lib/queue";
import { publishScheduled } from "@/lib/services/posting";
import { syncAllMetrics } from "@/lib/services/metric-sync";
import { syncAllGrowth } from "@/lib/services/growth-sync";
import { buildAllRecaps } from "@/lib/services/recap";
import { scoped } from "@/lib/logger";

const log = scoped("worker");

async function main() {
  const boss = await getBoss();

  // Scheduled posts: each job carries a postId; publish when due.
  await boss.work<{ postId: number }>(QUEUES.scheduledPost, async (jobs) => {
    for (const job of jobs) {
      log.info({ postId: job.data.postId }, "Publishing scheduled post");
      await publishScheduled(job.data.postId);
    }
  });

  // Recurring syncs.
  await boss.work(QUEUES.metricSync, async () => {
    log.info("Running metric sync");
    await syncAllMetrics();
  });
  await boss.work(QUEUES.growthSync, async () => {
    log.info("Running growth sync");
    await syncAllGrowth();
  });
  await boss.work(QUEUES.weeklyRecap, async () => {
    log.info("Building weekly recaps");
    await buildAllRecaps();
  });

  // Cron schedules (UTC). pg-boss dedupes identical schedules by queue name.
  await boss.schedule(QUEUES.metricSync, "0 */6 * * *"); // every 6 hours
  await boss.schedule(QUEUES.growthSync, "0 9 * * *"); // daily 09:00
  await boss.schedule(QUEUES.weeklyRecap, "0 9 * * 1"); // Mondays 09:00

  log.info("Worker started; queues and schedules registered");
}

main().catch((err) => {
  log.error({ err }, "Worker failed to start");
  process.exit(1);
});
