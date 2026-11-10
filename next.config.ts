import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["lightningcss", "node-cron"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
