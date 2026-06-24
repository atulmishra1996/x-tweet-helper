import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { blogs } from "@/lib/db/schema";
import { PageHeader } from "@/components/page-header";
import { BlogStudio } from "@/components/blog/blog-studio";

export default async function BlogEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const [blog] = await db
    .select()
    .from(blogs)
    .where(and(eq(blogs.id, Number(id)), eq(blogs.userId, user.id)))
    .limit(1);
  if (!blog) notFound();

  const initial = {
    id: blog.id,
    title: blog.title,
    topic: blog.topic,
    audience: blog.audience,
    goal: blog.goal,
    outline: blog.outline ?? [],
    contentMd: blog.contentMd ?? "",
    status: blog.status,
    step: blog.step,
    publishedUrl: blog.publishedUrl,
  };

  return (
    <>
      <PageHeader title="Blog Studio" description="Topic → Outline → Draft → Polish → Publish" />
      <BlogStudio initialBlog={initial} />
    </>
  );
}
