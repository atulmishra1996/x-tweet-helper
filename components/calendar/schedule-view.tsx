"use client";

import * as React from "react";
import { Clock, Send, X, Loader2, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Post {
  id: number;
  type: string;
  content: string[];
  status: string;
  scheduledAt: string | null;
  postedAt: string | null;
}

export function ScheduleView() {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [busy, setBusy] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    const res = await apiFetch<{ posts: Post[] }>("/api/content/posts");
    setPosts(res.posts);
  }, []);

  React.useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const scheduled = posts
    .filter((p) => p.status === "scheduled" && p.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
  const posted = posts
    .filter((p) => p.status === "posted")
    .sort((a, b) => new Date(b.postedAt ?? 0).getTime() - new Date(a.postedAt ?? 0).getTime())
    .slice(0, 10);

  async function postNow(id: number) {
    setBusy(id);
    try {
      await apiFetch("/api/x/post", { method: "POST", body: JSON.stringify({ postId: id }) });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function cancel(id: number) {
    setBusy(id);
    try {
      await apiFetch(`/api/content/posts/${id}`, { method: "PATCH", body: JSON.stringify({ scheduledAt: null }) });
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="size-4 text-[color:var(--color-warning)]" /> Upcoming ({scheduled.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {scheduled.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled. Schedule posts from the Tweet Studio.</p>
          ) : (
            scheduled.map((p) => (
              <div key={p.id} className="rounded-lg border border-border p-3">
                <p className="line-clamp-2 text-sm">{p.content[0]}</p>
                <div className="mt-2 flex items-center justify-between">
                  <Badge variant="warning">{new Date(p.scheduledAt!).toLocaleString()}</Badge>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => postNow(p.id)} disabled={busy === p.id}>
                      {busy === p.id ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Post now
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => cancel(p.id)} aria-label="Cancel schedule">
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="size-4 text-[color:var(--color-success)]" /> Recently posted
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {posted.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts yet.</p>
          ) : (
            posted.map((p) => (
              <div key={p.id} className="rounded-lg border border-border p-3">
                <p className="line-clamp-2 text-sm">{p.content[0]}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.postedAt ? new Date(p.postedAt).toLocaleString() : ""}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
