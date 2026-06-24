import { PageHeader } from "@/components/page-header";
import { LibraryView } from "@/components/library/library-view";

export default function LibraryPage() {
  return (
    <>
      <PageHeader title="Library" description="Everything you've drafted, scheduled, and published." />
      <LibraryView />
    </>
  );
}
