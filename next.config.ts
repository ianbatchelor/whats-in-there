import type { NextConfig } from "next";

// Static export: the same build is served by Vercel and bundled into the iOS and Android apps.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
