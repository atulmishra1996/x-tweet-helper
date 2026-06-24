import { PageHeader } from "@/components/page-header";
import { ScheduleView } from "@/components/calendar/schedule-view";

export default function CalendarPage() {
  return (
    <>
      <PageHeader title="Schedule" description="Your upcoming queue and recent posts." />
      <ScheduleView />
    </>
  );
}
