import { PageHeader } from "@/components/page-header";
import { AnalyticsView } from "@/components/analytics/analytics-view";

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader title="Analytics" description="Engagement trends and best-time-to-post, from your own history." />
      <AnalyticsView />
    </>
  );
}
