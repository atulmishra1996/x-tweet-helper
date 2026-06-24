import { PageHeader } from "@/components/page-header";
import { BlogList } from "@/components/blog/blog-list";

export default function BlogPage() {
  return (
    <>
      <PageHeader title="Blog Studio" description="Draft long-form posts with staged AI help, then export or publish." />
      <BlogList />
    </>
  );
}
