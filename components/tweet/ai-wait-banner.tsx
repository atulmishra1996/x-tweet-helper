"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

/** Shown while Antigravity / local LLM requests are in flight (often 30–90s). */
export function AiWaitBanner({ active }: { active: boolean }) {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
      <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-primary" />
      <p>
        Generating on your Mac via Antigravity… <span className="tabular-nums">{elapsed}s</span>
        {elapsed >= 15 ? " — still working, this can take up to ~90s." : " — usually 30–90s. Keep Antigravity IDE open."}
      </p>
    </div>
  );
}
