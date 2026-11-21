import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every route prerenders, so the build is plain files in out/, served by Cloudflare Workers Static Assets.
  // There is no server, so Cache Components / partial prefetching have nothing to do here.
  output: "export",
  experimental: {
    // ~8 KB of CSS in total: inlining it removes the render-blocking stylesheet requests
    inlineCss: true,
  },
};

export default nextConfig;
