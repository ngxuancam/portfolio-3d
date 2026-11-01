import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // ~8 KB of CSS in total: inlining it removes the render-blocking stylesheet requests
    inlineCss: true,
  },
};

export default nextConfig;
