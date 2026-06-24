"use client";

import * as React from "react";
import { Check, KeyRound, Loader2, Trash2, Save, Plug, PlugZap } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

type ProviderId = "openai" | "anthropic" | "google" | "grok";
interface ModelInfo { id: string; label: string }
interface ProviderConfig { id: ProviderId; label: string; models: ModelInfo[] }
interface ProviderStatus { id: ProviderId; label: string; configured: boolean; source: "env" | "db" | "local-proxy" | null }
interface LocalProxyStatus {
  enabled: boolean;
  mode: "antigravity" | "gemini-cli" | null;
  proxyUrl: string | null;
  connected: boolean;
  models: ModelInfo[];
  error?: string;
}
interface SettingsData {
  settings: {
    activeProvider: ProviderId;
    activeModel: string;
    voicePrompt: string;
    dailyGoal: number;
    weeklyGoal: number;
    metricSyncHours: number;
    featureOverrides: Record<string, { provider: string; model: string }>;
  };
  providers: ProviderStatus[];
  registry: Record<ProviderId, ProviderConfig>;
}

export function SettingsView() {
  const [data, setData] = React.useState<SettingsData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [keyInputs, setKeyInputs] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState<string | null>(null);
  const [savedFlash, setSavedFlash] = React.useState(false);
  const [localProxy, setLocalProxy] = React.useState<LocalProxyStatus | null>(null);

  const load = React.useCallback(async () => {
    const [res, proxy] = await Promise.all([
      apiFetch<SettingsData>("/api/settings"),
      apiFetch<LocalProxyStatus>("/api/settings/gemini-proxy").catch(() => null),
    ]);
    setData(res);
    setLocalProxy(proxy);
    setError(null);
  }, []);

  React.useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load settings"));
  }, [load]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const { settings, providers, registry } = data;

  async function saveKey(providerId: string) {
    const apiKey = keyInputs[providerId];
    if (!apiKey) return;
    setSaving(providerId);
    try {
      await apiFetch("/api/settings/providers", { method: "POST", body: JSON.stringify({ providerId, apiKey }) });
      setKeyInputs((p) => ({ ...p, [providerId]: "" }));
      await load();
    } finally {
      setSaving(null);
    }
  }

  async function removeKey(providerId: string) {
    setSaving(providerId);
    try {
      await apiFetch("/api/settings/providers", { method: "DELETE", body: JSON.stringify({ providerId }) });
      await load();
    } finally {
      setSaving(null);
    }
  }

  async function saveSettings(patch: Record<string, unknown>) {
    setSaving("settings");
    try {
      await apiFetch("/api/settings", { method: "PUT", body: JSON.stringify(patch) });
      await load();
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } finally {
      setSaving(null);
    }
  }

  const activeModels =
    settings.activeProvider === "google" && localProxy?.connected && localProxy.models.length > 0
      ? localProxy.models
      : registry[settings.activeProvider]?.models ?? [];

  const proxyTitle =
    localProxy?.mode === "antigravity"
      ? "Antigravity (local)"
      : localProxy?.mode === "gemini-cli"
        ? "Gemini CLI OAuth (deprecated)"
        : "Local LLM proxy";

  return (
    <div className="space-y-6">
      {localProxy?.enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {localProxy.connected ? (
                <PlugZap className="size-5 text-[color:var(--color-success)]" />
              ) : (
                <Plug className="size-5 text-muted-foreground" />
              )}
              {proxyTitle}
            </CardTitle>
            <CardDescription>
              {localProxy.mode === "antigravity"
                ? "Routes Gemini through your Antigravity IDE subscription — keep IDE open with a workspace and run the local bridge."
                : "Legacy Gemini CLI OAuth bridge (no longer works for individual Pro accounts)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {localProxy.connected ? (
              <Badge variant="success">
                <Check className="mr-1 size-3" /> Connected at {localProxy.proxyUrl}
              </Badge>
            ) : (
              <>
                <Badge variant="secondary">Not connected</Badge>
                <p className="text-muted-foreground">
                  {localProxy.error ??
                    (localProxy.mode === "antigravity"
                      ? "Open Antigravity IDE with a workspace, then run `npm run antigravity:proxy`."
                      : "Run `npm run gemini:proxy` (deprecated — use Antigravity instead).")}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Providers */}
      <Card>
        <CardHeader>
          <CardTitle>AI providers</CardTitle>
          <CardDescription>Add API keys to enable providers. Keys are encrypted at rest.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.values(registry).map((p) => {
            const status = providers.find((s) => s.id === p.id);
            const envManaged = status?.source === "env";
            const localProxySource = status?.source === "local-proxy";
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                <div className="flex min-w-32 items-center gap-2">
                  <KeyRound className="size-4 text-muted-foreground" />
                  <span className="font-medium">{p.label}</span>
                </div>
                {status?.configured ? (
                  <Badge variant="success">
                    <Check className="mr-1 size-3" />{" "}
                    {localProxySource
                      ? localProxy?.mode === "antigravity"
                        ? "Antigravity"
                        : "Local proxy"
                      : envManaged
                        ? "From env"
                        : "Configured"}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not configured</Badge>
                )}
                {localProxySource ? (
                  <p className="text-sm text-muted-foreground">
                    Using local Antigravity bridge. Set <code className="text-xs">ANTIGRAVITY_PROXY_URL</code> and run{" "}
                    <code className="text-xs">npm run antigravity:proxy</code> with Antigravity IDE open (workspace required).
                  </p>
                ) : !envManaged ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      type="password"
                      placeholder={`${p.label} API key`}
                      value={keyInputs[p.id] ?? ""}
                      onChange={(e) => setKeyInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    />
                    <Button size="sm" onClick={() => saveKey(p.id)} disabled={saving === p.id || !keyInputs[p.id]}>
                      {saving === p.id ? <Loader2 className="size-4 animate-spin" /> : "Save"}
                    </Button>
                    {status?.configured && status.source === "db" && (
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeKey(p.id)} aria-label="Remove key">
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Default model */}
      <Card>
        <CardHeader>
          <CardTitle>Default model</CardTitle>
          <CardDescription>Used across the app unless overridden per feature.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Provider</Label>
            <Select
              className="mt-1"
              value={settings.activeProvider}
              onChange={(e) => {
                const provider = e.target.value as ProviderId;
                saveSettings({ activeProvider: provider, activeModel: registry[provider].models[0].id });
              }}
            >
              {Object.values(registry).map((p) => {
                const configured = providers.find((s) => s.id === p.id)?.configured;
                return (
                  <option key={p.id} value={p.id} disabled={!configured}>
                    {p.label}
                    {configured ? "" : " (no key)"}
                  </option>
                );
              })}
            </Select>
          </div>
          <div>
            <Label>Model</Label>
            <Select className="mt-1" value={settings.activeModel} onChange={(e) => saveSettings({ activeModel: e.target.value })}>
              {activeModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Voice */}
      <VoiceCard initial={settings.voicePrompt} onSave={(v) => saveSettings({ voicePrompt: v })} saving={saving === "settings"} />

      {/* Goals & sync */}
      <Card>
        <CardHeader>
          <CardTitle>Goals & sync</CardTitle>
          <CardDescription>Targets for consistency and how often metrics refresh (cost control).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Daily goal (posts)</Label>
            <Input
              type="number"
              className="mt-1"
              defaultValue={settings.dailyGoal}
              onBlur={(e) => saveSettings({ dailyGoal: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Weekly goal (posts)</Label>
            <Input
              type="number"
              className="mt-1"
              defaultValue={settings.weeklyGoal}
              onBlur={(e) => saveSettings({ weeklyGoal: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Metric sync (hours)</Label>
            <Input
              type="number"
              className="mt-1"
              defaultValue={settings.metricSyncHours}
              onBlur={(e) => saveSettings({ metricSyncHours: Number(e.target.value) })}
            />
          </div>
        </CardContent>
      </Card>

      {savedFlash && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-md bg-[color:var(--color-success)] px-4 py-2 text-sm text-white shadow-lg">
          <Check className="size-4" /> Saved
        </div>
      )}
    </div>
  );
}

function VoiceCard({ initial, onSave, saving }: { initial: string; onSave: (v: string) => void; saving: boolean }) {
  const [value, setValue] = React.useState(initial);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Writing voice</CardTitle>
        <CardDescription>A short description of your style. Injected into every AI prompt.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Direct and practical. I write for senior engineers, favor concrete examples, light humor, no hype."
          className="min-h-28"
        />
        <Button onClick={() => onSave(value)} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save voice
        </Button>
      </CardContent>
    </Card>
  );
}
