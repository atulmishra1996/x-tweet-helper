"use client";

import * as React from "react";
import {
  Link2,
  Loader2,
  MessageCircle,
  Quote,
  Sparkles,
  Send,
  ExternalLink,
  ClipboardPaste,
  Copy,
  Check,
} from "lucide-react";
import { apiFetch, apiFetchAI } from "@/lib/client";
import { copyText, openReply, openQuote } from "@/lib/client-x-fallback";
import { parseTweetIdFromUrl, parseHandleFromTweetUrl, tweetPermalink } from "@/lib/x/tweet-url";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AiWaitBanner } from "@/components/tweet/ai-wait-banner";

const MAX = 280;
const TONES = ["sharp", "casual", "teaching", "story", "professional"] as const;

interface TweetReference {
  id: string;
  text: string;
  url: string;
  author: { handle: string; name: string; avatarUrl?: string };
  source: "api" | "manual";
}

export function TweetReplyPanel() {
  const [url, setUrl] = React.useState("");
  const [tweetText, setTweetText] = React.useState("");
  const [authorHandle, setAuthorHandle] = React.useState("");
  const [reference, setReference] = React.useState<TweetReference | null>(null);
  const [guidance, setGuidance] = React.useState("");
  const [tone, setTone] = React.useState<(typeof TONES)[number]>("sharp");
  const [reply, setReply] = React.useState("");
  const [variants, setVariants] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const handle = parseHandleFromTweetUrl(url);
    if (handle) setAuthorHandle(handle);
  }, [url]);

  async function withBusy(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setBusy(null);
    }
  }

  function buildManualReference(): TweetReference | null {
    const id = parseTweetIdFromUrl(url);
    if (!id) {
      setMessage({ kind: "err", text: "Paste a valid tweet URL (x.com/user/status/123…)." });
      return null;
    }
    if (!tweetText.trim()) {
      setMessage({ kind: "err", text: "Paste the tweet text so AI can draft a reply." });
      return null;
    }
    const handle = authorHandle.trim().replace(/^@/, "") || parseHandleFromTweetUrl(url) || "user";
    return {
      id,
      text: tweetText.trim(),
      url: url.trim() || tweetPermalink(handle, id),
      author: { handle, name: handle },
      source: "manual",
    };
  }

  function useManualReference() {
    const ref = buildManualReference();
    if (!ref) return;
    setReference(ref);
    setReply("");
    setVariants([]);
    setMessage({
      kind: "info",
      text: "Reference set. Use Generate replies, then Open in X (free) or Post via API (needs X credits).",
    });
  }

  function loadViaApi() {
    return withBusy("load", async () => {
      try {
        const res = await apiFetch<{ tweet: Omit<TweetReference, "source"> }>("/api/x/tweets/lookup", {
          method: "POST",
          body: JSON.stringify({ url }),
        });
        setReference({ ...res.tweet, source: "api" });
        setTweetText(res.tweet.text);
        setAuthorHandle(res.tweet.author.handle);
        setReply("");
        setVariants([]);
        setMessage({ kind: "ok", text: "Tweet loaded from X API." });
      } catch (err) {
        const text = err instanceof Error ? err.message : "Lookup failed";
        if (text.includes("402") || text.toLowerCase().includes("credit")) {
          setMessage({
            kind: "info",
            text: "X API credits required for lookup. Paste the tweet text and use “Use pasted text”, then “Open in X” to post without API credits.",
          });
        } else {
          throw err;
        }
      }
    });
  }

  function generateReplies() {
    const ref = reference ?? buildManualReference();
    if (!ref) return;
    if (!reference) setReference(ref);

    return withBusy("generate", async () => {
      const res = await apiFetchAI<{ variants: string[] }>("/api/ai/tweet", {
        method: "POST",
        body: JSON.stringify({
          mode: "reply",
          tweetText: ref.text,
          authorHandle: ref.author.handle,
          guidance,
          tone,
          count: 3,
        }),
      });
      setVariants(res.variants);
      if (res.variants[0] && !reply.trim()) setReply(res.variants[0]);
    });
  }

  function postAsReply() {
    const ref = reference;
    if (!ref || !reply.trim()) return;
    return withBusy("reply", async () => {
      await apiFetch("/api/x/tweets/post", {
        method: "POST",
        body: JSON.stringify({ text: reply.trim(), replyToTweetId: ref.id }),
      });
      setMessage({ kind: "ok", text: "Reply posted to X." });
    });
  }

  function postAsQuote() {
    const ref = reference;
    if (!ref || !reply.trim()) return;
    return withBusy("quote", async () => {
      await apiFetch("/api/x/tweets/post", {
        method: "POST",
        body: JSON.stringify({ text: reply.trim(), quoteTweetId: ref.id }),
      });
      setMessage({ kind: "ok", text: "Quote repost posted to X." });
    });
  }

  async function copyReply() {
    if (!reply.trim()) return;
    await copyText(reply.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function openReplyInX() {
    const ref = reference;
    if (!ref || !reply.trim()) return;
    openReply(ref.id, reply.trim());
  }

  function openQuoteInX() {
    const ref = reference;
    if (!ref || !reply.trim()) return;
    openQuote(reply.trim(), ref.url);
  }

  const count = reply.length;
  const over = count > MAX;
  const canSetReference = Boolean(parseTweetIdFromUrl(url) && tweetText.trim());
  const showComposer = reference || canSetReference;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="size-4 text-primary" /> Reply to a tweet
        </CardTitle>
        <CardDescription>
          Paste URL + tweet text for AI. Posting via API needs X developer credits — use Open in X to post free in the browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Tweet URL — https://x.com/user/status/123…"
        />

        <Textarea
          value={tweetText}
          onChange={(e) => setTweetText(e.target.value)}
          placeholder="Paste the tweet text you're replying to…"
          className="min-h-24"
        />

        <Input
          value={authorHandle}
          onChange={(e) => setAuthorHandle(e.target.value)}
          placeholder="@handle (auto-filled from URL)"
        />

        <div className="flex flex-wrap gap-2">
          <Button onClick={useManualReference} disabled={busy !== null || !canSetReference}>
            <ClipboardPaste className="size-4" /> Use pasted text
          </Button>
          <Button variant="outline" onClick={loadViaApi} disabled={busy !== null || !url.trim()}>
            {busy === "load" ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />} Fetch via API
          </Button>
        </div>

        {reference && (
          <div className="rounded-lg border border-border bg-accent/30 p-3 text-sm">
            <div className="mb-2 flex items-center gap-2">
              {reference.author.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={reference.author.avatarUrl} alt="" className="size-8 rounded-full" />
              ) : (
                <div className="size-8 rounded-full bg-secondary" />
              )}
              <div>
                <p className="font-medium leading-tight">@{reference.author.handle}</p>
                <p className="text-xs text-muted-foreground">
                  {reference.source === "manual" ? "Manual reference" : "Loaded from X API"}
                </p>
              </div>
              <a
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-muted-foreground hover:text-foreground"
                aria-label="Open on X"
              >
                <ExternalLink className="size-4" />
              </a>
            </div>
            <p className="whitespace-pre-wrap">{reference.text}</p>
          </div>
        )}

        {showComposer && (
          <>
            <AiWaitBanner active={busy === "generate"} />
            <Textarea
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="Optional: how you want to reply (angle, tone, point to make)…"
              className="min-h-16"
            />
            <div className="flex gap-2">
              <Select value={tone} onChange={(e) => setTone(e.target.value as (typeof TONES)[number])} className="h-9">
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </Select>
              <Button className="flex-1" onClick={generateReplies} disabled={busy !== null || !tweetText.trim()}>
                {busy === "generate" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{" "}
                Generate replies
              </Button>
            </div>

            {variants.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Tap to use:</p>
                {variants.map((v, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setReply(v)}
                    className="w-full rounded-md border border-border p-2.5 text-left text-sm hover:border-primary/50 hover:bg-accent"
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}

            <div>
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Your reply or quote comment…"
                className="min-h-20"
              />
              <div className="mt-1 flex justify-end">
                <span className={cn("text-xs tabular-nums", over ? "text-destructive" : "text-muted-foreground")}>
                  {count}/{MAX}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={postAsReply}
                disabled={busy !== null || !reply.trim() || over || !reference}
                title={!reference ? "Set reference first (Use pasted text)" : undefined}
              >
                {busy === "reply" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Post via API
              </Button>
              <Button
                variant="secondary"
                onClick={postAsQuote}
                disabled={busy !== null || !reply.trim() || over || !reference}
              >
                {busy === "quote" ? <Loader2 className="size-4 animate-spin" /> : <Quote className="size-4" />} Quote via API
              </Button>
              <Button variant="outline" onClick={openReplyInX} disabled={!reply.trim() || over || !reference}>
                <ExternalLink className="size-4" /> Reply in X
              </Button>
              <Button variant="outline" onClick={openQuoteInX} disabled={!reply.trim() || over || !reference}>
                <ExternalLink className="size-4" /> Quote in X
              </Button>
              <Button variant="ghost" onClick={copyReply} disabled={!reply.trim()}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copy
              </Button>
            </div>
          </>
        )}

        {message && (
          <div
            className={cn(
              "rounded-md px-3 py-2 text-sm",
              message.kind === "ok"
                ? "bg-[color:var(--color-success)]/10 text-[color:var(--color-success)]"
                : message.kind === "info"
                  ? "border border-border bg-accent/40 text-muted-foreground"
                  : "bg-destructive/10 text-destructive",
            )}
          >
            {message.text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
