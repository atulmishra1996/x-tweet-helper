/** Extract a numeric tweet id from an X/Twitter status URL or raw id string. */
export function parseTweetIdFromUrl(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d{5,}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i);
  return match?.[1] ?? null;
}

/** Extract @handle from a status URL (e.g. x.com/sidhant/status/123). */
export function parseHandleFromTweetUrl(input: string): string | null {
  const match = input.trim().match(/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/(\w+)\/status\/\d+/i);
  return match?.[1] ?? null;
}

export function tweetPermalink(handle: string, tweetId: string): string {
  return `https://x.com/${handle}/status/${tweetId}`;
}
