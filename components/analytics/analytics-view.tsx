"use client";

import * as React from "react";
import { Eye, Activity, MousePointerClick, Heart, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber, cn } from "@/lib/utils";

interface Totals {
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  profileClicks: number;
  urlClicks: number;
  engagements: number;
}
interface Overview {
  current: Totals;
  previous: Totals;
  engagementRate: number;
  postCount: number;
  days: number;
}
interface BestTimeCell {
  weekday: number;
  hour: number;
  avgEngagement: number;
  count: number;
}
interface PerPost {
  postId: number;
  type: string;
  text: string;
  postedAt: string | null;
  metrics: Totals;
  engagementRate: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function trend(cur: number, prev: number): { text: string; positive: boolean } {
  if (prev === 0) return { text: cur > 0 ? "new" : "—", positive: cur > 0 };
  const pct = ((cur - prev) / prev) * 100;
  return { text: `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`, positive: pct >= 0 };
}

export function AnalyticsView() {
  const [days, setDays] = React.useState(7);
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [cells, setCells] = React.useState<BestTimeCell[]>([]);
  const [posts, setPosts] = React.useState<PerPost[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sortKey, setSortKey] = React.useState<"impressions" | "engagementRate" | "likes">("impressions");

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<{ overview: Overview }>(`/api/analytics/overview?days=${days}`),
      apiFetch<{ cells: BestTimeCell[] }>("/api/analytics/best-time"),
      apiFetch<{ posts: PerPost[] }>(`/api/analytics/posts?days=${Math.max(days, 30)}`),
    ])
      .then(([o, b, p]) => {
        setOverview(o.overview);
        setCells(b.cells);
        setPosts(p.posts);
      })
      .finally(() => setLoading(false));
  }, [days]);

  if (loading || !overview) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const c = overview.current;
  const p = overview.previous;
  const interactions = c.likes + c.retweets + c.replies + c.quotes;
  const prevInteractions = p.likes + p.retweets + p.replies + p.quotes;

  const cards = [
    { label: "Impressions", icon: Eye, value: formatNumber(c.impressions), t: trend(c.impressions, p.impressions) },
    {
      label: "Engagement rate",
      icon: Activity,
      value: `${overview.engagementRate.toFixed(1)}%`,
      t: trend(interactions / (c.impressions || 1), prevInteractions / (p.impressions || 1)),
    },
    { label: "Interactions", icon: Heart, value: formatNumber(interactions), t: trend(interactions, prevInteractions) },
    {
      label: "Profile clicks",
      icon: MousePointerClick,
      value: formatNumber(c.profileClicks),
      t: trend(c.profileClicks, p.profileClicks),
    },
  ];

  const maxEng = Math.max(1, ...cells.map((x) => x.avgEngagement));
  const sorted = [...posts].sort((a, b) =>
    sortKey === "engagementRate"
      ? b.engagementRate - a.engagementRate
      : b.metrics[sortKey] - a.metrics[sortKey],
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        {[7, 30].map((d) => (
          <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>
            {d}d
          </Button>
        ))}
      </div>

      {overview.postCount === 0 && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No posts with metrics yet in this window. Metrics are snapshotted by the background worker after you post.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{card.label}</span>
                <card.icon className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-2xl font-bold">{card.value}</p>
              <p
                className={cn(
                  "mt-1 text-xs",
                  card.t.positive ? "text-[color:var(--color-success)]" : "text-muted-foreground",
                )}
              >
                {card.t.text} vs prev {days}d
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Best time heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Best time to post</CardTitle>
        </CardHeader>
        <CardContent>
          {cells.length === 0 ? (
            <p className="text-sm text-muted-foreground">Post more to learn your best times.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-[auto_repeat(24,minmax(14px,1fr))] gap-1 text-[10px]">
                <div />
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className="text-center text-muted-foreground">
                    {h % 6 === 0 ? h : ""}
                  </div>
                ))}
                {WEEKDAYS.map((wd, w) => (
                  <React.Fragment key={wd}>
                    <div className="pr-1 text-right text-muted-foreground">{wd}</div>
                    {Array.from({ length: 24 }).map((_, h) => {
                      const cell = cells.find((x) => x.weekday === w && x.hour === h);
                      const intensity = cell ? cell.avgEngagement / maxEng : 0;
                      return (
                        <div
                          key={h}
                          className="aspect-square rounded-sm"
                          style={{
                            backgroundColor: cell
                              ? `color-mix(in oklch, var(--color-primary) ${Math.round(intensity * 100)}%, var(--color-secondary))`
                              : "var(--color-secondary)",
                          }}
                          title={cell ? `${wd} ${h}:00 — avg ${cell.avgEngagement.toFixed(1)} (${cell.count} posts)` : `${wd} ${h}:00`}
                        />
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-post table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Posts</CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts in range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Post</th>
                    {(
                      [
                        ["impressions", "Impressions"],
                        ["likes", "Likes"],
                        ["engagementRate", "Eng. rate"],
                      ] as const
                    ).map(([key, label]) => (
                      <th key={key} className="pb-2 pr-3 font-medium">
                        <button onClick={() => setSortKey(key)} className={cn("hover:text-foreground", sortKey === key && "text-foreground")}>
                          {label}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((post) => (
                    <tr key={post.postId} className="border-b border-border/50">
                      <td className="py-2 pr-3">
                        <p className="line-clamp-1 max-w-md">{post.text}</p>
                        <span className="text-xs text-muted-foreground">
                          {post.postedAt ? new Date(post.postedAt).toLocaleDateString() : ""}{" "}
                          <Badge variant="secondary" className="ml-1">{post.type}</Badge>
                        </span>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{formatNumber(post.metrics.impressions)}</td>
                      <td className="py-2 pr-3 tabular-nums">{formatNumber(post.metrics.likes)}</td>
                      <td className="py-2 pr-3 tabular-nums">{post.engagementRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
