import { networkInterfaces } from "node:os";

/** First non-internal IPv4 on the machine (typical Wi‑Fi/LAN address). */
export function getLanIp(): string | null {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) return entry.address;
    }
  }
  return null;
}

export function lanAppUrl(port = 3000): string | null {
  const ip = getLanIp();
  return ip ? `http://${ip}:${port}` : null;
}
