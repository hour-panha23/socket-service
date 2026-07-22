// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/apps",
        destination: "http://localhost:4000/apps",
      },
      {
        source: "/apps/:path*",
        destination: "http://localhost:4000/apps/:path*",
      },
      {
        source: "/notifications",
        destination: "http://localhost:4000/notifications",
      },
      {
        source: "/notifications/:path*",
        destination: "http://localhost:4000/notifications/:path*",
      },
    ];
  },
};

export default nextConfig;
