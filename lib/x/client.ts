import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, type User } from "@/lib/db/schema";
import { encrypt, decrypt } from "@/lib/crypto";
import { refreshAccessToken } from "@/lib/auth/x-oauth";
import { AppError, RateLimitedError } from "@/lib/errors";
import { formatXCreditsError } from "@/lib/x/intent";
import { scoped } from "@/lib/logger";

const log = scoped("x-client");
const API_BASE = "https://api.x.com";
const REFRESH_SKEW_MS = 60_000; // refresh if expiring within 60s

/** Ensure a valid (non-expired) access token, refreshing + persisting if needed. */
export async function ensureAccessToken(user: User): Promise<string> {
  if (!user.accessToken) throw new AppError("X_API_ERROR", "X account not connected", 401);

  const expiringSoon =
    user.tokenExpiresAt != null && user.tokenExpiresAt.getTime() - Date.now() < REFRESH_SKEW_MS;

  if (expiringSoon && user.refreshToken) {
    try {
      const refreshed = await refreshAccessToken(decrypt(user.refreshToken));
      const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
      const accessEnc = encrypt(refreshed.access_token);
      const refreshEnc = refreshed.refresh_token ? encrypt(refreshed.refresh_token) : user.refreshToken;
      await db
        .update(users)
        .set({ accessToken: accessEnc, refreshToken: refreshEnc, tokenExpiresAt: expiresAt, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      // Mutate in place so subsequent calls in this request use the new token.
      user.accessToken = accessEnc;
      user.refreshToken = refreshEnc;
      user.tokenExpiresAt = expiresAt;
      return refreshed.access_token;
    } catch (err) {
      log.error({ err, userId: user.id }, "Token refresh failed");
      throw new AppError("X_API_ERROR", "Failed to refresh X token. Please reconnect.", 401);
    }
  }

  return decrypt(user.accessToken);
}

async function xFetch(user: User, path: string, init: RequestInit, retryOn401 = true): Promise<unknown> {
  const token = await ensureAccessToken(user);
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 429) {
    const reset = res.headers.get("x-rate-limit-reset");
    const retryAfter = reset ? Math.max(0, Number(reset) * 1000 - Date.now()) / 1000 : undefined;
    throw new RateLimitedError("X API rate limit reached", retryAfter);
  }

  if (res.status === 401 && retryOn401 && user.refreshToken) {
    // Force a refresh by expiring the token and retrying once.
    user.tokenExpiresAt = new Date(0);
    return xFetch(user, path, init, false);
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (json as { detail?: string; title?: string })?.detail ?? (json as { title?: string })?.title;
    const method = init.method ?? "GET";
    const message =
      res.status === 402
        ? formatXCreditsError(res.status, detail, method)
        : `X API error (${res.status}): ${detail ?? "unknown"}`;
    throw new AppError("X_API_ERROR", message, res.status === 402 ? 402 : 502, json);
  }
  return json;
}

export interface PostedTweet {
  id: string;
  text: string;
}

/** Post a single tweet, optionally as a reply or quote tweet. */
export async function postTweet(
  user: User,
  text: string,
  opts?: { replyToId?: string; quoteTweetId?: string },
): Promise<PostedTweet> {
  const body: Record<string, unknown> = { text };
  if (opts?.replyToId) body.reply = { in_reply_to_tweet_id: opts.replyToId };
  if (opts?.quoteTweetId) body.quote_tweet_id = opts.quoteTweetId;
  const json = (await xFetch(user, "/2/tweets", { method: "POST", body: JSON.stringify(body) })) as {
    data: PostedTweet;
  };
  return json.data;
}

/** Post a thread by chaining replies. Returns the X tweet ids in order. */
export async function postThread(user: User, texts: string[]): Promise<string[]> {
  const ids: string[] = [];
  let replyTo: string | undefined;
  for (const text of texts) {
    const tweet = await postTweet(user, text, { replyToId: replyTo });
    ids.push(tweet.id);
    replyTo = tweet.id;
  }
  return ids;
}

export interface TweetAuthor {
  id: string;
  handle: string;
  name: string;
  avatarUrl?: string;
}

export interface FetchedTweet {
  id: string;
  text: string;
  createdAt?: string;
  author: TweetAuthor;
  url: string;
}

interface TweetLookupByIdResponse {
  data?: {
    id: string;
    text: string;
    created_at?: string;
    author_id?: string;
  };
  includes?: {
    users?: Array<{
      id: string;
      username: string;
      name: string;
      profile_image_url?: string;
    }>;
  };
  errors?: Array<{ detail?: string; title?: string }>;
}

/** Fetch a public tweet by id (requires tweet.read scope). */
export async function lookupTweet(user: User, tweetId: string): Promise<FetchedTweet> {
  const fields = "created_at,author_id,text";
  const expansions = "author_id";
  const userFields = "username,name,profile_image_url";
  const json = (await xFetch(
    user,
    `/2/tweets/${tweetId}?tweet.fields=${fields}&expansions=${expansions}&user.fields=${userFields}`,
    { method: "GET" },
  )) as TweetLookupByIdResponse;

  const tweet = json.data;
  if (!tweet) {
    const detail = json.errors?.[0]?.detail ?? json.errors?.[0]?.title ?? "Tweet not found";
    throw new AppError("X_API_ERROR", detail, 404);
  }

  const authorUser = json.includes?.users?.find((u) => u.id === tweet.author_id);
  const handle = authorUser?.username ?? "i";
  return {
    id: tweet.id,
    text: tweet.text,
    createdAt: tweet.created_at,
    author: {
      id: tweet.author_id ?? "",
      handle,
      name: authorUser?.name ?? handle,
      avatarUrl: authorUser?.profile_image_url,
    },
    url: `https://x.com/${handle}/status/${tweet.id}`,
  };
}

export interface XMetrics {
  tweetId: string;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  urlClicks: number;
  profileClicks: number;
  engagements: number;
}

interface TweetLookupResponse {
  data?: Array<{
    id: string;
    public_metrics?: {
      impression_count?: number;
      like_count?: number;
      retweet_count?: number;
      reply_count?: number;
      quote_count?: number;
      bookmark_count?: number;
    };
    non_public_metrics?: {
      impression_count?: number;
      url_link_clicks?: number;
      user_profile_clicks?: number;
      engagements?: number;
    };
    organic_metrics?: {
      impression_count?: number;
      url_link_clicks?: number;
      user_profile_clicks?: number;
    };
  }>;
}

/**
 * Look up metrics for up to 100 owned tweets. Private metrics
 * (non_public/organic) only work for the author's posts within 30 days.
 */
export async function lookupTweetMetrics(user: User, tweetIds: string[]): Promise<XMetrics[]> {
  if (tweetIds.length === 0) return [];
  const ids = tweetIds.slice(0, 100).join(",");
  const fields = "public_metrics,non_public_metrics,organic_metrics";
  const json = (await xFetch(
    user,
    `/2/tweets?ids=${ids}&tweet.fields=${fields}`,
    { method: "GET" },
  )) as TweetLookupResponse;

  return (json.data ?? []).map((t) => {
    const pub = t.public_metrics ?? {};
    const np = t.non_public_metrics ?? {};
    return {
      tweetId: t.id,
      impressions: pub.impression_count ?? np.impression_count ?? 0,
      likes: pub.like_count ?? 0,
      retweets: pub.retweet_count ?? 0,
      replies: pub.reply_count ?? 0,
      quotes: pub.quote_count ?? 0,
      bookmarks: pub.bookmark_count ?? 0,
      urlClicks: np.url_link_clicks ?? 0,
      profileClicks: np.user_profile_clicks ?? 0,
      engagements: np.engagements ?? 0,
    };
  });
}

interface MeResponse {
  data: {
    id: string;
    username: string;
    name: string;
    public_metrics?: { followers_count?: number; following_count?: number };
  };
}

/** Fetch the authenticated user's profile + follower counts. */
export async function getMe(user: User): Promise<{ followers: number; following: number; handle: string }> {
  const json = (await xFetch(
    user,
    "/2/users/me?user.fields=public_metrics",
    { method: "GET" },
  )) as MeResponse;
  return {
    followers: json.data.public_metrics?.followers_count ?? 0,
    following: json.data.public_metrics?.following_count ?? 0,
    handle: json.data.username,
  };
}
