import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatDelta(n: number | null | undefined): string {
  if (n == null || n === 0) return "0";
  return n > 0 ? `+${formatNumber(n)}` : `-${formatNumber(Math.abs(n))}`;
}

export function pct(value: number, total: number): number {
  if (!total) return 0;
  return (value / total) * 100;
}
