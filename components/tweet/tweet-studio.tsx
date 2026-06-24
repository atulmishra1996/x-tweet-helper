"use client";

import * as React from "react";
import {
  Sparkles,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Send,
  Save,
  Clock,
  Wand2,
  Scissors,
  Megaphone,
  Hash,
  SpellCheck,
  Loader2,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { apiFetch, apiFetchAI } from "@/lib/client";
import { copyText, openCompose } from "@/lib/client-x-fallback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TweetReplyPanel } from "@/components/tweet/tweet-reply-panel";
import { AiWaitBanner } from "@/components/tweet/ai-wait-banner";
import { cn } from "@/lib/utils";

type MobileTab = "ai" | "write" | "reply";

const MAX = 280;
const TONES = ["sharp", "casual", "teaching", "story", "professional"] as const;
const ACTIONS = [
  { id: "shorten", label: "Shorten", icon: Scissors },
  { id: "punch_up", label: "Punch up", icon: Wand2 },
  { id: "add_cta", label: "Add CTA", icon: Megaphone },
  { id: "hashtags", label: "Hashtags", icon: Hash },
  { id: "fix_grammar", label: "Fix grammar", icon: SpellCheck },
] as const;

export function TweetStudio({ initialIdea = "", initialTweets }: { initialIdea?: string; initialTweets?: string[] }) {
  const [tweets, setTweets] = React.useState<string[]>(initialTweets ?? [""]);
  const [active, setActive] = React.useState(0);
  const [idea, setIdea] = React.useState(initialIdea);
  const [tone, setTone] = React.useState<(typeof TONES)[number]>("sharp");
  const [variants, setVariants] = React.useState<string[]>([]);
  const [postId, setPostId] = React.useState<number | null>(null);
  const [scheduleAt, setScheduleAt] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [mobileTab, setMobileTab] = React.useState<MobileTab>("ai");

  const isAiBusy = busy === "variants" || busy === "thread" || ACTIONS.some((a) => a.id === busy);

  const isThread = tweets.length > 1;

  function setTweet(i: number, value: string) {
    setTweets((prev) => prev.map((t, idx) => (idx === i ? value : t)));
  }
  function addTweet() {
    setTweets((prev) => [...prev, ""]);
    setActive(tweets.length);
  }
  function removeTweet(i: number) {
    setTweets((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
    setActive((a) => Math.max(0, a - (i <= a ? 1 : 0)));
  }
  function move(i: number, dir: -1 | 1) {
    setTweets((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

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

  function generateVariants() {
    return withBusy("variants", async () => {
      const res = await apiFetchAI<{ variants: string[] }>("/api/ai/tweet", {
        method: "POST",
        body: JSON.stringify({ mode: "variants", idea, tone, count: 3 }),
      });
      setVariants(res.variants);
    });
  }

  function generateThread() {
    return withBusy("thread", async () => {
      const res = await apiFetchAI<{ thread: string[] }>("/api/ai/tweet", {
        method: "POST",
        body: JSON.stringify({ mode: "thread", idea, length: 5 }),
      });
      if (res.thread.length) {
        setTweets(res.thread);
        setActive(0);
        setMobileTab("write");
      }
    });
  }

  function runAction(action: string) {
    return withBusy(action, async () => {
      const res = await apiFetchAI<{ text: string }>("/api/ai/tweet", {
        method: "POST",
        body: JSON.stringify({ mode: "action", action, text: tweets[active] }),
      });
      setTweet(active, res.text);
    });
  }

  async function persist(status: "draft" | "scheduled"): Promise<number> {
    const content = tweets.map((t) => t.trim()).filter(Boolean);
    const payload = {
      type: isThread ? "thread" : "tweet",
      content,
      status,
      scheduledAt: status === "scheduled" && scheduleAt ? new Date(scheduleAt).toISOString() : undefined,
    };
    if (postId) {
      const res = await apiFetch<{ post: { id: number } }>(`/api/content/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      return res.post.id;
    }
    const res = await apiFetch<{ post: { id: number } }>("/api/content/posts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setPostId(res.post.id);
    return res.post.id;
  }

  function saveDraft() {
    return withBusy("save", async () => {
      await persist("draft");
      setMessage({ kind: "ok", text: "Draft saved." });
    });
  }

  function schedule() {
    return withBusy("schedule", async () => {
      if (!scheduleAt) {
        setMessage({ kind: "err", text: "Pick a date and time first." });
        return;
      }
      await persist("scheduled");
      setMessage({ kind: "ok", text: `Scheduled for ${new Date(scheduleAt).toLocaleString()}.` });
    });
  }

  function postNow() {
    return withBusy("post", async () => {
      const id = await persist("draft");
      const res = await apiFetch<{ post: { postedTweetIds: string[] } }>("/api/x/post", {
        method: "POST",
        body: JSON.stringify({ postId: id }),
      });
      const first = res.post.postedTweetIds?.[0];
      setMessage({ kind: "ok", text: first ? "Posted to X." : "Posted." });
    });
  }

  async function copyForX() {
    const content = tweets.map((t) => t.trim()).filter(Boolean);
    const text = isThread ? content.join("\n\n---\n\n") : (content[0] ?? "");
    await copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function openInX() {
    const content = tweets.map((t) => t.trim()).filter(Boolean);
    if (content.length === 0) return;
    openCompose(content[0]);
    if (isThread) {
      setMessage({
        kind: "err",
        text: "Opened first tweet in X. Copy the full thread and paste remaining tweets as replies. Then log on the dashboard.",
      });
    } else {
      setMessage({
        kind: "ok",
        text: "Opened in X. After posting, use “Log on dashboard” on the home page to update your streak.",
      });
    }
  }

  async function logManualOnDashboard() {
    const content = tweets.map((t) => t.trim()).filter(Boolean);
    if (content.length === 0) return;
    return withBusy("log", async () => {
      await apiFetch("/api/stats/log-manual", {
        method: "POST",
        body: JSON.stringify({
          posts: [{ text: content.join("\n\n---\n\n"), type: isThread ? "thread" : "tweet" }],
        }),
      });
      setMessage({ kind: "ok", text: "Logged for your dashboard streak." });
    });
  }

  const overLimit = tweets.some((t) => t.length > MAX);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg border border-border p-1 lg:hidden">
        {(
          [
            { id: "ai" as const, label: "AI" },
            { id: "write" as const, label: "Write" },
            { id: "reply" as const, label: "Reply" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobileTab(tab.id)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              mobileTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AiWaitBanner active={isAiBusy} />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      {/* Editor */}
      <div className={cn(mobileTab !== "write" && "hidden", "lg:block")}>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{isThread ? "Thread" : "Tweet"}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isThread ? "default" : "secondary"}>{tweets.length} tweet{tweets.length > 1 ? "s" : ""}</Badge>
            <Button size="sm" variant="outline" onClick={addTweet}>
              <Plus className="size-4" /> Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {tweets.map((t, i) => {
            const count = t.length;
            const over = count > MAX;
            return (
              <div
                key={i}
                onFocus={() => setActive(i)}
                className={cn(
                  "rounded-lg border p-3 transition-colors",
                  active === i ? "border-primary/50 bg-accent/40" : "border-border",
                )}
              >
                <Textarea
                  value={t}
                  onChange={(e) => setTweet(i, e.target.value)}
                  placeholder={i === 0 ? "What do you want to say?" : "Continue the thread…"}
                  className="min-h-20 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                />
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {isThread && (
                      <>
                        <Button size="icon" variant="ghost" className="size-7" onClick={() => move(i, -1)} aria-label="Move up">
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-7" onClick={() => move(i, 1)} aria-label="Move down">
                          <ArrowDown className="size-3.5" />
                        </Button>
                      </>
                    )}
                    {tweets.length > 1 && (
                      <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => removeTweet(i)} aria-label="Delete">
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                  <span className={cn("text-xs tabular-nums", over ? "text-destructive" : "text-muted-foreground")}>
                    {count}/{MAX}
                  </span>
                </div>
              </div>
            );
          })}

          {message && (
            <div
              className={cn(
                "rounded-md px-3 py-2 text-sm",
                message.kind === "ok"
                  ? "bg-[color:var(--color-success)]/10 text-[color:var(--color-success)]"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {message.text}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button onClick={postNow} disabled={busy !== null || overLimit}>
              {busy === "post" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Post via API
            </Button>
            <Button variant="secondary" onClick={copyForX} disabled={busy !== null || !tweets.some((t) => t.trim())}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copy
            </Button>
            <Button variant="outline" onClick={openInX} disabled={busy !== null || !tweets.some((t) => t.trim())}>
              <ExternalLink className="size-4" /> Open in X
            </Button>
            <Button variant="outline" onClick={logManualOnDashboard} disabled={busy !== null || !tweets.some((t) => t.trim())}>
              {busy === "log" ? <Loader2 className="size-4 animate-spin" /> : null} Log posted
            </Button>
            <Button variant="secondary" onClick={saveDraft} disabled={busy !== null}>
              {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save draft
            </Button>
            <div className="flex items-center gap-2">
              <Input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="h-9 w-auto"
              />
              <Button variant="outline" onClick={schedule} disabled={busy !== null || overLimit}>
                {busy === "schedule" ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />} Schedule
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>

      {/* AI panel */}
      <div className="space-y-5">
        <div className={cn(mobileTab !== "reply" && "hidden", "lg:block")}>
        <TweetReplyPanel />
        </div>

        <div className={cn(mobileTab !== "ai" && "hidden", "space-y-5 lg:block")}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" /> AI assist
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Describe your idea or paste notes…"
              className="min-h-20"
            />
            <div className="flex items-center gap-2">
              <Select value={tone} onChange={(e) => setTone(e.target.value as (typeof TONES)[number])} className="h-9">
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={generateVariants} disabled={busy !== null || !idea.trim()}>
                {busy === "variants" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Hooks
              </Button>
              <Button variant="secondary" className="flex-1" onClick={generateThread} disabled={busy !== null || !idea.trim()}>
                {busy === "thread" ? <Loader2 className="size-4 animate-spin" /> : null} Thread
              </Button>
            </div>

            {variants.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-medium text-muted-foreground">Tap to use:</p>
                {variants.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setTweet(active, v);
                      setMobileTab("write");
                    }}
                    className="w-full rounded-md border border-border p-2.5 text-left text-sm hover:border-primary/50 hover:bg-accent"
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Refine tweet {active + 1}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {ACTIONS.map((a) => (
              <Button
                key={a.id}
                variant="outline"
                size="sm"
                onClick={() => runAction(a.id)}
                disabled={busy !== null || !tweets[active]?.trim()}
              >
                {busy === a.id ? <Loader2 className="size-4 animate-spin" /> : <a.icon className="size-4" />} {a.label}
              </Button>
            ))}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
    </div>
  );
}
