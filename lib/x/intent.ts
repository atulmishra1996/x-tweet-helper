/** Web intent URLs — open X compose UI in the browser (no API credits needed). */

export function composeTweetIntent(text: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

export function replyIntent(tweetId: string, text?: string): string {
  const params = new URLSearchParams({ in_reply_to: tweetId });
  if (text?.trim()) params.set("text", text.trim());
  return `https://x.com/intent/tweet?${params.toString()}`;
}

export function quoteIntent(text: string, tweetUrl: string): string {
  const params = new URLSearchParams({ text: text.trim(), url: tweetUrl });
  return `https://x.com/intent/tweet?${params.toString()}`;
}

export function formatXCreditsError(status: number, detail: string | undefined, method: string): string {
  if (status !== 402) {
    return `X API error (${status}): ${detail ?? "unknown"}`;
  }
  const action =
    method === "GET"
      ? "read/lookup"
      : method === "POST" && detail?.toLowerCase().includes("tweet")
        ? "posting"
        : "this action";
  return (
    `X API credits required (${action}). New X developer accounts use pay-per-use billing — ` +
    `purchase credits at developer.x.com (Developer Console → billing). ` +
    `Until then, use “Copy” or “Open in X” to post manually in the browser.`
  );
}
