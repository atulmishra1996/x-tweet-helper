"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Plus, Loader2, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Blog {
  id: number;
  title: string;
  status: string;
  step: string;
  updatedAt: string;
}

export function BlogList() {
  const router = useRouter();
  const [blogs, setBlogs] = React.useState<Blog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiFetch<{ blogs: Blog[] }>("/api/content/blogs")
      .then((r) => setBlogs(r.blogs))
      .finally(() => setLoading(false));
  }, []);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await apiFetch<{ blog: { id: number } }>("/api/content/blogs", {
        method: "POST",
        body: JSON.stringify({ title: "Untitled" }),
      });
      router.push(`/blog/${res.blog.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create blog");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: number) {
    await apiFetch(`/api/content/blogs/${id}`, { method: "DELETE" });
    setBlogs((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-end gap-2">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={create} disabled={creating}>
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} New blog
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : blogs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No blogs yet. Start your first draft.
        </p>
      ) : (
        <div className="grid gap-3">
          {blogs.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <Link href={`/blog/${b.id}`} className="flex min-w-0 items-center gap-3">
                  <FileText className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{b.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated {new Date(b.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  <Badge variant={b.status === "published" ? "success" : "secondary"}>{b.status}</Badge>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(b.id)} aria-label="Delete">
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
