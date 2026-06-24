import type { NextConfig } from "next";

function allowedDevOrigins(): string[] {
  const origins = new Set(["127.0.0.1", "localhost"]);
  const fromAppUrl = process.env.APP_URL?.match(/^https?:\/\/([^:/]+)/)?.[1];
  if (fromAppUrl) origins.add(fromAppUrl);
  if (process.env.LAN_HOST) origins.add(process.env.LAN_HOST);
  return [...origins];
}

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "pg-boss", "pino"],
  allowedDevOrigins: allowedDevOrigins(),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "abs.twimg.com" },
    ],
  },
};

export default nextConfig;
