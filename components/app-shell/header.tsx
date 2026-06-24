"use client";

import Image from "next/image";
import { LogOut } from "lucide-react";
import { ProviderSwitcher } from "@/components/provider-switcher";
import { Button } from "@/components/ui/button";

export function Header({ handle, avatarUrl, displayName }: { handle: string; avatarUrl?: string | null; displayName?: string | null }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card/40 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <ProviderSwitcher />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={handle}
              width={28}
              height={28}
              className="rounded-full"
              unoptimized
            />
          ) : (
            <div className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
              {handle.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="hidden text-sm sm:block">
            <p className="font-medium leading-none">{displayName ?? handle}</p>
            <p className="text-xs text-muted-foreground">@{handle}</p>
          </div>
        </div>
        <form action="/api/auth/logout" method="get">
          <Button type="submit" variant="ghost" size="icon" aria-label="Log out">
            <LogOut className="size-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
