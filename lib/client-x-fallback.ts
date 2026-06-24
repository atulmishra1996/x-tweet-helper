"use client";

import { composeTweetIntent, quoteIntent, replyIntent } from "@/lib/x/intent";

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export function openInX(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function openCompose(text: string): void {
  openInX(composeTweetIntent(text));
}

export function openReply(tweetId: string, text?: string): void {
  openInX(replyIntent(tweetId, text));
}

export function openQuote(text: string, tweetUrl: string): void {
  openInX(quoteIntent(text, tweetUrl));
}
