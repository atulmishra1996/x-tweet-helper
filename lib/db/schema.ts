import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  date,
  index,
  uniqueIndex,
  bigint,
} from "drizzle-orm/pg-core";

/**
 * Single-user app: most tables carry a userId for forward-compatibility with
 * multi-user, but in practice there is one row in `users`.
 */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  xUserId: text("x_user_id").notNull().unique(),
  handle: text("handle").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  // Encrypted at rest (AES-256-GCM). Never sent to the client.
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  scopes: text("scopes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const providerKeys = pgTable(
  "provider_keys",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(), // openai | anthropic | google | grok
    apiKeyEncrypted: text("api_key_encrypted").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("provider_keys_user_provider_uq").on(t.userId, t.providerId)],
);

export const settings = pgTable("settings", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  activeProvider: text("active_provider").notNull().default("google"),
  activeModel: text("active_model").notNull().default("gemini-flash-latest"),
  // { tweet?: {provider,model}, blog?: {provider,model} }
  featureOverrides: jsonb("feature_overrides").$type<Record<string, { provider: string; model: string }>>().default({}),
  voicePrompt: text("voice_prompt").default(""),
  metricSyncHours: integer("metric_sync_hours").notNull().default(6),
  dailyGoal: integer("daily_goal").notNull().default(1),
  weeklyGoal: integer("weekly_goal").notNull().default(7),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ideas = pgTable(
  "ideas",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    tags: jsonb("tags").$type<string[]>().default([]),
    sourceUrl: text("source_url"),
    status: text("status").notNull().default("inbox"), // inbox | used | archived
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ideas_user_status_idx").on(t.userId, t.status)],
);

/** A unit of publishable content: a single tweet or a thread. */
export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("tweet"), // tweet | thread
    // For tweet: ["text"]. For thread: ["tweet 1", "tweet 2", ...].
    content: jsonb("content").$type<string[]>().notNull(),
    status: text("status").notNull().default("draft"), // draft | scheduled | posting | posted | failed
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    // X tweet IDs returned after posting (one per item in a thread).
    postedTweetIds: jsonb("posted_tweet_ids").$type<string[]>().default([]),
    topic: text("topic"),
    tags: jsonb("tags").$type<string[]>().default([]),
    sourceIdeaId: integer("source_idea_id"),
    sourceBlogId: integer("source_blog_id"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("posts_user_status_idx").on(t.userId, t.status),
    index("posts_scheduled_idx").on(t.scheduledAt),
  ],
);

/** Time-series engagement snapshots. Many rows per post over its lifetime. */
export const postMetrics = pgTable(
  "post_metrics",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    // The specific X tweet id this snapshot is for (first tweet of a thread by default).
    tweetId: text("tweet_id").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    impressions: integer("impressions").default(0),
    likes: integer("likes").default(0),
    retweets: integer("retweets").default(0),
    replies: integer("replies").default(0),
    quotes: integer("quotes").default(0),
    bookmarks: integer("bookmarks").default(0),
    urlClicks: integer("url_clicks").default(0),
    profileClicks: integer("profile_clicks").default(0),
    engagements: integer("engagements").default(0),
  },
  (t) => [index("post_metrics_post_captured_idx").on(t.postId, t.capturedAt)],
);

export const blogs = pgTable(
  "blogs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled"),
    topic: text("topic"),
    audience: text("audience"),
    goal: text("goal"), // teach | opinion | story | tutorial
    outline: jsonb("outline").$type<{ heading: string; notes?: string }[]>().default([]),
    contentMd: text("content_md").default(""),
    status: text("status").notNull().default("draft"), // draft | published
    step: text("step").notNull().default("topic"), // topic | outline | draft | polish | publish
    publishedUrl: text("published_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("blogs_user_status_idx").on(t.userId, t.status)],
);

/** Daily snapshots for follower + subscriber growth tracking. */
export const growthSnapshots = pgTable(
  "growth_snapshots",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    capturedOn: date("captured_on").notNull(),
    followers: integer("followers"),
    following: integer("following"),
    // Manual sources (no stable public API): logged by the user.
    xSubscribers: integer("x_subscribers"),
    xSubRevenueCents: integer("x_sub_revenue_cents"),
    newsletterSubscribers: integer("newsletter_subscribers"),
    source: text("source").notNull().default("sync"), // sync | manual
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("growth_user_date_uq").on(t.userId, t.capturedOn)],
);

export const dailyActivity = pgTable(
  "daily_activity",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    postsPublished: integer("posts_published").notNull().default(0),
    wordsWritten: integer("words_written").notNull().default(0),
  },
  (t) => [uniqueIndex("daily_activity_user_day_uq").on(t.userId, t.day)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_created_idx").on(t.createdAt)],
);

// Inferred types for use across the app.
export type User = typeof users.$inferSelect;
export type ProviderKey = typeof providerKeys.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Idea = typeof ideas.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type PostMetric = typeof postMetrics.$inferSelect;
export type Blog = typeof blogs.$inferSelect;
export type GrowthSnapshot = typeof growthSnapshots.$inferSelect;
export type DailyActivity = typeof dailyActivity.$inferSelect;
