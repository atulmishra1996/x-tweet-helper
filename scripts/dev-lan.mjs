#!/usr/bin/env node
/**
 * Start Antigravity bridge + Next.js bound to all interfaces for phone access on LAN.
 */
import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";

function getLanIp() {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) return entry.address;
    }
  }
  return null;
}

const port = process.env.PORT ?? "3000";
const ip = process.env.LAN_HOST ?? getLanIp();

console.log(`
╔══════════════════════════════════════════════════════════╗
║  Twitter Helper — LAN mode (Mac as server)               ║
╠══════════════════════════════════════════════════════════╣
║  On this Mac:     http://127.0.0.1:${port}${" ".repeat(Math.max(0, 18 - String(port).length))}║
${ip ? `║  On your phone:   http://${ip}:${port}${" ".repeat(Math.max(0, 18 - ip.length - String(port).length))}║` : "║  (Could not detect LAN IP — check Wi‑Fi)                 ║"}
╠══════════════════════════════════════════════════════════╣
║  • Phone must be on the same Wi‑Fi as this Mac           ║
║  • Keep Antigravity IDE open + workspace on this Mac      ║
║  • For X login from phone, set in .env.local:            ║
${ip ? `║      APP_URL=http://${ip}:${port}${" ".repeat(Math.max(0, 22 - ip.length - String(port).length))}║` : "║      APP_URL=http://<your-mac-ip>:3000                   ║"}
${ip ? `║      X_CALLBACK_URL=http://${ip}:${port}/api/auth/x/callback${" ".repeat(Math.max(0, 4 - String(port).length))}║` : "║      X_CALLBACK_URL=http://<ip>:3000/api/auth/x/callback ║"}
║    and add that callback URL at developer.x.com           ║
╚══════════════════════════════════════════════════════════╝
`);

const cmd = `npx concurrently -n ag,web -c cyan,green "npm run antigravity:proxy" "next dev --hostname 0.0.0.0 -p ${port}"`;

const child = spawn(cmd, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    ...(ip ? { LAN_HOST: ip } : {}),
  },
  cwd: process.cwd(),
});

child.on("exit", (code) => process.exit(code ?? 0));
