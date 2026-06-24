"use client";

import * as React from "react";
import {
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  Download,
  Copy,
  Check,
  Wand2,
  MessageSquare,
} from "lucide-react";
import { apiFetch, apiFetchAI } from "@/lib/client";
import { extractSectionBody } from "@/lib/prompts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface OutlineItem {
  heading: string;
  notes?: string;
}
interface Blog {
  id: number;
  title: string;
  topic?: string | null;
  audience?: string | null;
  goal?: string | null;
  outline: OutlineItem[];
  contentMd: string;
  status: string;
  step: string;
  publishedUrl?: string | null;
}

const STEPS = ["topic", "outline", "draft", "polish", "publish"] as const;
type Step = (typeof STEPS)[number];

export function BlogStudio({ initialBlog }: { initialBlog: Blog }) {
  const [blog, setBlog] = React.useState<Blog>(initialBlog);
  const [step, setStep] = React.useState<Step>((initialBlog.step as Step) ?? "topic");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [threadPreview, setThreadPreview] = React.useState<string[]>([]);

  // Debounced autosave whenever blog fields change.
  const firstRender = React.useRef(true);
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(async () => {
      try {
        await apiFetch(`/api/content/blogs/${blog.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: blog.title,
            topic: blog.topic,
            audience: blog.audience,
            goal: blog.goal,
            outline: blog.outline,
            contentMd: blog.contentMd,
            step,
          }),
        });
        setSavedAt(new Date());
        setSaveError(null);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Autosave failed");
      }
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blog, step]);

  function patch(p: Partial<Blog>) {
    setBlog((prev) => ({ ...prev, ...p }));
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

  function generateOutline() {
    return withBusy("outline", async () => {
      const res = await apiFetchAI<{ outline: OutlineItem[] }>("/api/ai/blog", {
        method: "POST",
        body: JSON.stringify({
          mode: "outline",
          title: blog.title,
          topic: blog.topic,
          audience: blog.audience,
          goal: blog.goal,
        }),
      });
      patch({ outline: res.outline });
      setStep("outline");
    });
  }

  function generateSection(item: OutlineItem, action: "expand" | "tighten" | "example") {
    return withBusy(`section-${item.heading}-${action}`, async () => {
      const existing = extractSectionBody(blog.contentMd ?? "", item.heading);
      const res = await apiFetchAI<{ text: string }>("/api/ai/blog", {
        method: "POST",
        body: JSON.stringify({
          mode: "section",
          title: blog.title,
          heading: item.heading,
          notes: item.notes,
          existing: action !== "expand" ? existing : undefined,
          sectionAction: action,
        }),
      });
      const block = `\n\n## ${item.heading}\n\n${res.text}\n`;
      setBlog((prev) => {
        if (action === "expand" && existing) {
          const escaped = item.heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const re = new RegExp(`(^##\\s+${escaped}\\s*\\n)([\\s\\S]*?)(?=^##\\s+|\\Z)`, "im");
          if (re.test(prev.contentMd ?? "")) {
            return {
              ...prev,
              contentMd: (prev.contentMd ?? "").replace(re, `$1${res.text}\n\n`),
            };
          }
        }
        return { ...prev, contentMd: (prev.contentMd ?? "") + block };
      });
    });
  }

  function polish() {
    return withBusy("polish", async () => {
      const res = await apiFetchAI<{ text: string }>("/api/ai/blog", {
        method: "POST",
        body: JSON.stringify({ mode: "polish", title: blog.title, contentMd: blog.contentMd }),
      });
      patch({ contentMd: res.text });
    });
  }

  function generateThread() {
    return withBusy("thread", async () => {
      const res = await apiFetchAI<{ variants: string[] }>("/api/ai/blog", {
        method: "POST",
        body: JSON.stringify({ mode: "tweets", title: blog.title, contentMd: blog.contentMd, count: 5 }),
      });
      setThreadPreview(res.variants);
    });
  }

  function download() {
    const blob = new Blob([`# ${blog.title}\n\n${blog.contentMd}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${blog.title.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    await navigator.clipboard.writeText(`# ${blog.title}\n\n${blog.contentMd}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const words = (blog.contentMd ?? "").split(/\s+/).filter(Boolean).length;
  const readMin = Math.max(1, Math.round(words / 200));

  return (
    <div className="space-y-5">
      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              step === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-secondary text-xs">{i + 1}</span>
            {s}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 px-2 text-xs text-muted-foreground">
          <span>{words} words · {readMin} min</span>
          {savedAt && <span>Saved {savedAt.toLocaleTimeString()}</span>}
          {saveError && <span className="text-destructive">{saveError}</span>}
        </div>
      </div>

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

      {step === "topic" && (
        <Card>
          <CardHeader>
            <CardTitle>Topic</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Title</label>
              <Input value={blog.title} onChange={(e) => patch({ title: e.target.value })} placeholder="A compelling title" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Topic</label>
                <Input value={blog.topic ?? ""} onChange={(e) => patch({ topic: e.target.value })} placeholder="e.g. system design" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Audience</label>
                <Input value={blog.audience ?? ""} onChange={(e) => patch({ audience: e.target.value })} placeholder="e.g. junior devs" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Goal</label>
                <Select value={blog.goal ?? "teach"} onChange={(e) => patch({ goal: e.target.value })}>
                  <option value="teach">Teach</option>
                  <option value="opinion">Opinion</option>
                  <option value="story">Story</option>
                  <option value="tutorial">Tutorial</option>
                </Select>
              </div>
            </div>
            <Button onClick={generateOutline} disabled={busy !== null || !blog.title.trim()}>
              {busy === "outline" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Generate outline
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "outline" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Outline</CardTitle>
            <Button size="sm" variant="outline" onClick={() => patch({ outline: [...blog.outline, { heading: "New section" }] })}>
              <Plus className="size-4" /> Add section
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {blog.outline.length === 0 && (
              <Button onClick={generateOutline} disabled={busy !== null}>
                {busy === "outline" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Generate outline
              </Button>
            )}
            {blog.outline.map((item, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-border p-3">
                <div className="flex-1 space-y-2">
                  <Input
                    value={item.heading}
                    onChange={(e) =>
                      patch({ outline: blog.outline.map((o, idx) => (idx === i ? { ...o, heading: e.target.value } : o)) })
                    }
                  />
                  <Input
                    value={item.notes ?? ""}
                    onChange={(e) =>
                      patch({ outline: blog.outline.map((o, idx) => (idx === i ? { ...o, notes: e.target.value } : o)) })
                    }
                    placeholder="Section notes (optional)"
                    className="text-sm"
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => patch({ outline: blog.outline.filter((_, idx) => idx !== i) })}
                  aria-label="Remove section"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {blog.outline.length > 0 && (
              <Button variant="secondary" onClick={() => setStep("draft")}>
                Continue to draft
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {step === "draft" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <Card>
            <CardHeader>
              <CardTitle>Draft (Markdown)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={blog.contentMd ?? ""}
                onChange={(e) => patch({ contentMd: e.target.value })}
                placeholder="Write your blog in Markdown, or generate sections from the outline →"
                className="min-h-[480px] font-mono text-sm"
              />
            </CardContent>
          </Card>
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Sections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {blog.outline.length === 0 && <p className="text-sm text-muted-foreground">Add outline sections to generate content.</p>}
              {blog.outline.map((item, i) => (
                <div key={i} className="space-y-1.5 rounded-md border border-border p-2.5">
                  <p className="text-sm font-medium">{item.heading}</p>
                  <div className="flex flex-wrap gap-1">
                    {(["expand", "tighten", "example"] as const).map((a) => (
                      <Button
                        key={a}
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs capitalize"
                        onClick={() => generateSection(item, a)}
                        disabled={busy !== null}
                      >
                        {busy === `section-${item.heading}-${a}` ? <Loader2 className="size-3 animate-spin" /> : null}
                        {a}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
              <Button variant="secondary" className="w-full" onClick={() => setStep("polish")}>
                Continue to polish
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "polish" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Polish</CardTitle>
            <Button onClick={polish} disabled={busy !== null}>
              {busy === "polish" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} Polish with AI
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea
              value={blog.contentMd ?? ""}
              onChange={(e) => patch({ contentMd: e.target.value })}
              className="min-h-[480px] font-mono text-sm"
            />
            <Button variant="secondary" className="mt-3" onClick={() => setStep("publish")}>
              Continue to publish
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "publish" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Publish & export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button onClick={download}>
                  <Download className="size-4" /> Download .md
                </Button>
                <Button variant="secondary" onClick={copy}>
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copy
                </Button>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Published URL (optional)</label>
                <Input
                  value={blog.publishedUrl ?? ""}
                  onChange={(e) => patch({ publishedUrl: e.target.value })}
                  placeholder="https://…"
                />
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  apiFetch(`/api/content/blogs/${blog.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ status: "published", publishedUrl: blog.publishedUrl }),
                  }).then(() => patch({ status: "published" }))
                }
              >
                Mark as published
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Tweet thread from blog</CardTitle>
              <Button size="sm" onClick={generateThread} disabled={busy !== null}>
                {busy === "thread" ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4" />} Generate
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {threadPreview.length === 0 ? (
                <p className="text-sm text-muted-foreground">Generate tweet angles to promote this blog.</p>
              ) : (
                threadPreview.map((t, i) => (
                  <div key={i} className="rounded-md border border-border p-2.5 text-sm">
                    {t}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
