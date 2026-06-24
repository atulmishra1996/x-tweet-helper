"use client";

import * as React from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Post {
  id: number;
  type: string;
  content: string[];
  status: string;
  createdAt: string;
}
interface Blog {
  id: number;
  title: string;
  status: string;
  updatedAt: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  draft: "secondary",
  scheduled: "warning",
  posted: "success",
  failed: "destructive",
  published: "success",
};

export function LibraryView() {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [blogs, setBlogs] = React.useState<Blog[]>([]);
  const [tab, setTab] = React.useState("tweets");

  React.useEffect(() => {
    apiFetch<{ posts: Post[] }>("/api/content/posts").then((r) => setPosts(r.posts)).catch(() => {});
    apiFetch<{ blogs: Blog[] }>("/api/content/blogs").then((r) => setBlogs(r.blogs)).catch(() => {});
  }, []);

  const tweets = posts.filter((p) => p.type === "tweet");
  const threads = posts.filter((p) => p.type === "thread");
  const published = posts.filter((p) => p.status === "posted");

  function PostRow({ p }: { p: Post }) {
    return (
      <Card>
        <CardContent className="flex items-start justify-between gap-4 py-4">
          <p className="line-clamp-2 text-sm">{p.content[0]}</p>
          <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>{p.status}</Badge>
        </CardContent>
      </Card>
    );
  }

  function Empty({ label }: { label: string }) {
    return (
      <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{label}</p>
    );
  }

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="mb-4">
        <TabsTrigger value="tweets">Tweets ({tweets.length})</TabsTrigger>
        <TabsTrigger value="threads">Threads ({threads.length})</TabsTrigger>
        <TabsTrigger value="blogs">Blogs ({blogs.length})</TabsTrigger>
        <TabsTrigger value="published">Published ({published.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="tweets" className="grid gap-3">
        {tweets.length ? tweets.map((p) => <PostRow key={p.id} p={p} />) : <Empty label="No tweets yet." />}
      </TabsContent>
      <TabsContent value="threads" className="grid gap-3">
        {threads.length ? threads.map((p) => <PostRow key={p.id} p={p} />) : <Empty label="No threads yet." />}
      </TabsContent>
      <TabsContent value="blogs" className="grid gap-3">
        {blogs.length ? (
          blogs.map((b) => (
            <Link key={b.id} href={`/blog/${b.id}`}>
              <Card>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <p className="font-medium">{b.title}</p>
                  <Badge variant={STATUS_VARIANT[b.status] ?? "secondary"}>{b.status}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <Empty label="No blogs yet." />
        )}
      </TabsContent>
      <TabsContent value="published" className="grid gap-3">
        {published.length ? published.map((p) => <PostRow key={p.id} p={p} />) : <Empty label="Nothing published yet." />}
      </TabsContent>
    </Tabs>
  );
}
