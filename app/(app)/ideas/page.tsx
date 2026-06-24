import { PageHeader } from "@/components/page-header";
import { IdeasView } from "@/components/ideas/ideas-view";

export default function IdeasPage() {
  return (
    <>
      <PageHeader title="Ideas Inbox" description="Capture ideas fast. Turn them into tweets or blogs when you're ready." />
      <IdeasView />
    </>
  );
}
