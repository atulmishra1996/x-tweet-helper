import { PageHeader } from "@/components/page-header";
import { GrowthView } from "@/components/growth/growth-view";

export default function GrowthPage() {
  return (
    <>
      <PageHeader title="Growth" description="Followers, subscribers, recommendations, and your weekly recap." />
      <GrowthView />
    </>
  );
}
