import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { Dashboard } from "@/components/home/dashboard";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  return (
    <>
      <PageHeader
        title={`Welcome back${user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}`}
        description="Your X growth at a glance."
      />
      <Dashboard />
    </>
  );
}
