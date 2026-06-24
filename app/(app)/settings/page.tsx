import { PageHeader } from "@/components/page-header";
import { SettingsView } from "@/components/settings/settings-view";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Providers, writing voice, goals, and sync." />
      <SettingsView />
    </>
  );
}
