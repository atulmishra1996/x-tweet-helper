"use client";

import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Lightbulb, RefreshCw, Loader2, TrendingUp, Crown, Mail, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber } from "@/lib/utils";

interface GrowthPoint {
  date: string;
  followers: number | null;
  xSubscribers: number | null;
  newsletterSubscribers: number | null;
}
interface Recommendation { id: string; title: string; detail: string }
interface Recap {
  generatedAt: string;
  impressions: number;
  engagementRate: number;
  postsPublished: number;
  followerDelta: number | null;
  topPost: { text: string; engagementRate: number } | null;
}
interface GrowthData {
  series: GrowthPoint[];
  recommendations: Recommendation[];
  recap: Recap | null;
}

export function GrowthView() {
  const [data, setData] = React.useState<GrowthData | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [manual, setManual] = React.useState({ xSubscribers: "", newsletterSubscribers: "" });
  const [savingManual, setSavingManual] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await apiFetch<GrowthData>("/api/growth");
    setData(res);
  }, []);

  React.useEffect(() => {
    load().catch(() => {});
  }, [load]);

  async function syncFollowers() {
    setSyncing(true);
    try {
      await apiFetch("/api/growth/sync", { method: "POST" });
      await load();
    } finally {
      setSyncing(false);
    }
  }

  async function saveManual() {
    setSavingManual(true);
    try {
      const payload: Record<string, number> = {};
      if (manual.xSubscribers) payload.xSubscribers = Number(manual.xSubscribers);
      if (manual.newsletterSubscribers) payload.newsletterSubscribers = Number(manual.newsletterSubscribers);
      await apiFetch("/api/growth", { method: "POST", body: JSON.stringify(payload) });
      setManual({ xSubscribers: "", newsletterSubscribers: "" });
      await load();
    } finally {
      setSavingManual(false);
    }
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const followerSeries = data.series.filter((p) => p.followers != null);
  const latest = followerSeries[followerSeries.length - 1]?.followers ?? null;
  const first = followerSeries[0]?.followers ?? null;
  const delta = latest != null && first != null ? latest - first : null;
  const latestSubs = [...data.series].reverse().find((p) => p.xSubscribers != null)?.xSubscribers ?? null;
  const latestNews = [...data.series].reverse().find((p) => p.newsletterSubscribers != null)?.newsletterSubscribers ?? null;

  const chartData = followerSeries.map((p) => ({
    date: new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    followers: p.followers,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Followers</span>
              <TrendingUp className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold">{latest != null ? formatNumber(latest) : "—"}</p>
            {delta != null && (
              <p className="mt-1 text-xs text-[color:var(--color-success)]">
                {delta >= 0 ? "+" : ""}
                {formatNumber(delta)} tracked
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">X subscribers</span>
              <Crown className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold">{latestSubs != null ? formatNumber(latestSubs) : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Newsletter</span>
              <Mail className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold">{latestNews != null ? formatNumber(latestNews) : "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Follower growth</CardTitle>
          <Button size="sm" variant="outline" onClick={syncFollowers} disabled={syncing}>
            {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Sync now
          </Button>
        </CardHeader>
        <CardContent>
          {chartData.length < 2 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Not enough data yet. The daily worker snapshots followers; click &quot;Sync now&quot; to capture one immediately.
            </p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line type="monotone" dataKey="followers" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="size-4 text-[color:var(--color-warning)]" /> Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recommendations.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-3">
                <p className="font-medium">{r.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{r.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Log subscribers</CardTitle>
              <CardDescription>X subs and newsletter aren&apos;t in the API — log them here to chart growth.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>X subscribers</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={manual.xSubscribers}
                    onChange={(e) => setManual((m) => ({ ...m, xSubscribers: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Newsletter subs</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={manual.newsletterSubscribers}
                    onChange={(e) => setManual((m) => ({ ...m, newsletterSubscribers: e.target.value }))}
                  />
                </div>
              </div>
              <Button onClick={saveManual} disabled={savingManual}>
                {savingManual ? <Loader2 className="size-4 animate-spin" /> : null} Save today
              </Button>
            </CardContent>
          </Card>

          {data.recap && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4 text-primary" /> Weekly recap
                </CardTitle>
                <CardDescription>{new Date(data.recap.generatedAt).toLocaleDateString()}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>{data.recap.postsPublished} posts · {formatNumber(data.recap.impressions)} impressions</p>
                <p>{data.recap.engagementRate.toFixed(1)}% engagement rate</p>
                {data.recap.followerDelta != null && <p>{data.recap.followerDelta >= 0 ? "+" : ""}{data.recap.followerDelta} followers</p>}
                {data.recap.topPost && <p className="text-muted-foreground">Top: “{data.recap.topPost.text.slice(0, 80)}…”</p>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
