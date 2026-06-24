"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  Activity,
  Eye,
  Crown,
  Flame,
  PenSquare,
  FileText,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber, formatDelta, cn } from "@/lib/utils";

interface Summary {
  overview: {
    current: { impressions: number };
    engagementRate: number;
    postCount: number;
  };
  prevEngagementRate: number;
  streak: { streak: number; last7: { day: string; count: number }[] };
  counts: { draft: number; scheduled: number; posted: number };
  goal: { daily: number; weekly: number };
  followers: number | null;
  followerDelta: number | null;
  subscribers: number | null;
  recent: { id: number; text: string; type: string; postedAt: string | null }[];
}

function Kpi({
  icon: Icon,
  label,
  value,
  delta,
  positive,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <p className="mt-2 text-2xl font-bold">{value}</p>
        {delta && (
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-xs",
              positive ? "text-[color:var(--color-success)]" : "text-muted-foreground",
            )}
          >
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {delta}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const [data, setData] = React.useState<Summary | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [idea, setIdea] = React.useState("");
  const [savingIdea, setSavingIdea] = React.useState(false);
  const [loggingPosts, setLoggingPosts] = React.useState(false);

  const load = React.useCallback(() => {
    return apiFetch<Summary>("/api/stats/summary")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function logManualPosts(count: number) {
    setLoggingPosts(true);
    try {
      await apiFetch("/api/stats/log-manual", {
        method: "POST",
        body: JSON.stringify({ count }),
      });
      await load();
    } finally {
      setLoggingPosts(false);
    }
  }

  async function captureIdea() {
    if (!idea.trim()) return;
    setSavingIdea(true);
    try {
      await apiFetch("/api/ideas", { method: "POST", body: JSON.stringify({ text: idea.trim() }) });
      setIdea("");
    } finally {
      setSavingIdea(false);
    }
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {error}. Try refreshing, or{" "}
        <a href="/api/auth/logout" className="underline">
          sign out and back in
        </a>{" "}
        at{" "}
        <a href="http://127.0.0.1:3000/login" className="underline">
          http://127.0.0.1:3000
        </a>
        .
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const erDelta = data.overview.engagementRate - data.prevEngagementRate;
  const maxDay = Math.max(1, ...data.streak.last7.map((d) => d.count));
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayPosts = data.streak.last7.find((d) => d.day === todayKey)?.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={Users}
          label="Followers"
          value={data.followers != null ? formatNumber(data.followers) : "—"}
          delta={data.followerDelta != null ? `${formatDelta(data.followerDelta)} recently` : undefined}
          positive={(data.followerDelta ?? 0) > 0}
        />
        <Kpi
          icon={Activity}
          label="Engagement rate (7d)"
          value={`${data.overview.engagementRate.toFixed(1)}%`}
          delta={`${erDelta >= 0 ? "+" : ""}${erDelta.toFixed(1)}% vs prev`}
          positive={erDelta >= 0}
        />
        <Kpi icon={Eye} label="Impressions (7d)" value={formatNumber(data.overview.current.impressions)} />
        <Kpi
          icon={Crown}
          label="Subscribers"
          value={data.subscribers != null ? formatNumber(data.subscribers) : "—"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Flame className="size-4 text-[color:var(--color-warning)]" /> Consistency
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-bold">{data.streak.streak} day{data.streak.streak === 1 ? "" : "s"}</p>
                  <p className="text-sm text-muted-foreground">
                    Current posting streak · <span className="font-medium text-foreground">{todayPosts} today</span>
                  </p>
                  {todayPosts === 0 && (
                    <p className="mt-2 max-w-sm text-xs text-muted-foreground">
                      Posts via &quot;Open in X&quot; aren&apos;t tracked automatically (X API credits required for that).
                      Log them below after you publish.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={loggingPosts} onClick={() => logManualPosts(1)}>
                      {loggingPosts ? <Loader2 className="size-3 animate-spin" /> : null} Log 1 tweet
                    </Button>
                    <Button size="sm" variant="outline" disabled={loggingPosts} onClick={() => logManualPosts(2)}>
                      Log 2 tweets
                    </Button>
                  </div>
                </div>
                <div className="flex items-end gap-1.5">
                  {data.streak.last7.map((d) => (
                    <div key={d.day} className="flex flex-col items-center gap-1">
                      <div
                        className={cn("w-6 rounded-sm", d.count > 0 ? "bg-primary" : "bg-secondary")}
                        style={{ height: `${8 + (d.count / maxDay) * 36}px` }}
                        title={`${d.day}: ${d.count} posts`}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(d.day).toLocaleDateString(undefined, { weekday: "narrow" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Today&apos;s focus</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link href="/tweet">
                <Button>
                  <PenSquare className="size-4" /> Write today&apos;s tweet
                </Button>
              </Link>
              <Link href="/blog">
                <Button variant="secondary">
                  <FileText className="size-4" /> Continue a blog
                </Button>
              </Link>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{data.counts.draft} drafts</span>
                <span>{data.counts.scheduled} scheduled</span>
                <span>{data.counts.posted} posted</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent posts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing posted yet. Ship your first tweet!</p>
              ) : (
                data.recent.map((p) => (
                  <div key={p.id} className="rounded-md border border-border p-2.5 text-sm">
                    <p className="line-clamp-2">{p.text}</p>
                    {p.postedAt && (
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(p.postedAt).toLocaleString()}</p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick capture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Jot down an idea…"
                className="min-h-24"
              />
              <Button className="w-full" onClick={captureIdea} disabled={savingIdea || !idea.trim()}>
                {savingIdea ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Save idea
              </Button>
              <Link href="/ideas" className="block text-center text-xs text-muted-foreground hover:text-foreground">
                View all ideas →
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
