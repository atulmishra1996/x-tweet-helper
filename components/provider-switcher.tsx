"use client";

import * as React from "react";
import { Cpu, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ProviderId = "openai" | "anthropic" | "google" | "grok";

interface ModelInfo {
  id: string;
  label: string;
}
interface ProviderConfig {
  id: ProviderId;
  label: string;
  models: ModelInfo[];
}
interface ProviderStatus {
  id: ProviderId;
  label: string;
  configured: boolean;
}
interface SettingsResponse {
  settings: { activeProvider: ProviderId; activeModel: string };
  providers: ProviderStatus[];
  registry: Record<ProviderId, ProviderConfig>;
  localProxy?: {
    enabled: boolean;
    connected: boolean;
    mode: "antigravity" | "gemini-cli" | null;
    models: ModelInfo[];
  };
}

export function ProviderSwitcher() {
  const [data, setData] = React.useState<SettingsResponse | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    apiFetch<SettingsResponse>("/api/settings")
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Cpu className="size-4" /> …
      </div>
    );
  }

  const { settings, providers, registry, localProxy } = data;
  const configured = providers.filter((p) => p.configured);
  const current = registry[settings.activeProvider];
  const models =
    settings.activeProvider === "google" && localProxy?.connected && localProxy.models.length > 0
      ? localProxy.models
      : (current?.models ?? []);

  async function update(patch: { activeProvider?: ProviderId; activeModel?: string }) {
    setSaving(true);
    try {
      const next = { ...settings, ...patch };
      if (patch.activeProvider) {
        next.activeModel = registry[patch.activeProvider].models[0].id;
      }
      await apiFetch("/api/settings", { method: "PUT", body: JSON.stringify(next) });
      setData({ settings: next, providers, registry });
    } finally {
      setSaving(false);
    }
  }

  if (configured.length === 0) {
    return (
      <a
        href="/settings"
        className="flex items-center gap-2 rounded-md border border-warning/40 bg-[color:var(--color-warning)]/10 px-2.5 py-1.5 text-xs font-medium text-[color:var(--color-warning)]"
      >
        <AlertCircle className="size-4" /> No AI provider — add a key
      </a>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", saving && "opacity-60")}>
      <Cpu className="size-4 text-muted-foreground" />
      <Select
        aria-label="AI provider"
        className="hidden h-8 w-auto text-xs md:block"
        value={settings.activeProvider}
        onChange={(e) => update({ activeProvider: e.target.value as ProviderId })}
      >
        {Object.values(registry).map((p) => {
          const isConfigured = configured.some((c) => c.id === p.id);
          return (
            <option key={p.id} value={p.id} disabled={!isConfigured}>
              {p.label}
              {isConfigured ? "" : " (no key)"}
            </option>
          );
        })}
      </Select>
      <Select
        aria-label="Model"
        className="h-8 w-auto max-w-[9.5rem] text-xs sm:max-w-none"
        value={settings.activeModel}
        onChange={(e) => update({ activeModel: e.target.value })}
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
