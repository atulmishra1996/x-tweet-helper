"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, PenSquare, Archive, Trash2, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface Idea {
  id: number;
  text: string;
  sourceUrl?: string | null;
  createdAt: string;
}

export function IdeasView() {
  const [ideas, setIdeas] = React.useState<Idea[]>([]);
  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [adding, setAdding] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await apiFetch<{ ideas: Idea[] }>("/api/ideas?status=inbox");
    setIdeas(res.ideas);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  async function add() {
    if (!text.trim()) return;
    setAdding(true);
    try {
      await apiFetch("/api/ideas", { method: "POST", body: JSON.stringify({ text: text.trim() }) });
      setText("");
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function update(id: number, status: string) {
    await apiFetch(`/api/ideas/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    setIdeas((prev) => prev.filter((i) => i.id !== id));
  }

  async function remove(id: number) {
    await apiFetch(`/api/ideas/${id}`, { method: "DELETE" });
    setIdeas((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-5">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Capture an idea, hook, or link to write about later…"
            className="min-h-20"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") add();
            }}
          />
          <div className="mt-3 flex justify-end">
            <Button onClick={add} disabled={adding || !text.trim()}>
              {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add idea
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : ideas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No ideas yet. Capture your first one above.
        </p>
      ) : (
        <div className="grid gap-3">
          {ideas.map((idea) => (
            <Card key={idea.id}>
              <CardContent className="flex items-start justify-between gap-4 py-4">
                <p className="text-sm">{idea.text}</p>
                <div className="flex shrink-0 items-center gap-1">
                  <Link href={`/tweet?idea=${encodeURIComponent(idea.text)}`}>
                    <Button size="sm" variant="outline">
                      <PenSquare className="size-4" /> Tweet
                    </Button>
                  </Link>
                  <Button size="icon" variant="ghost" onClick={() => update(idea.id, "archived")} aria-label="Archive">
                    <Archive className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(idea.id)} aria-label="Delete">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
