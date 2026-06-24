import PgBoss from "pg-boss";
import { env } from "@/lib/env";
import { scoped } from "@/lib/logger";

const log = scoped("queue");

/** Queue names. pg-boss requires queues to exist before send/work. */
export const QUEUES = {
  scheduledPost: "scheduled-post",
  metricSync: "metric-sync",
  growthSync: "growth-sync",
  weeklyRecap: "weekly-recap",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

let bossPromise: Promise<PgBoss> | null = null;

/** Lazily start a shared pg-boss instance and ensure queues exist. */
export async function getBoss(): Promise<PgBoss> {
  if (!bossPromise) {
    const boss = new PgBoss({ connectionString: env.DATABASE_URL });
    boss.on("error", (err) => log.error({ err }, "pg-boss error"));
    bossPromise = boss.start().then(async () => {
      for (const q of Object.values(QUEUES)) {
        await boss.createQueue(q);
      }
      log.info("pg-boss started; queues ready");
      return boss;
    });
  }
  return bossPromise;
}

export async function enqueueScheduledPost(postId: number, when: Date): Promise<void> {
  const boss = await getBoss();
  await boss.send(QUEUES.scheduledPost, { postId }, { startAfter: when, retryLimit: 3, retryBackoff: true });
}

export async function enqueueNow(name: QueueName, data: Record<string, unknown> = {}): Promise<void> {
  const boss = await getBoss();
  await boss.send(name, data, { retryLimit: 3, retryBackoff: true });
}
