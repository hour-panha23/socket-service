// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "https://decorated-unzip-outer.ngrok-free.de",
    "192.9.31.22",
    "192.9.31.18",
    "172.25.112.1",
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/project",
        destination: "http://localhost:4000/project",
      },
      {
        source: "/project/:path*",
        destination: "http://localhost:4000/project/:path*",
      },
      {
        source: "/project",
        destination: "https://decorated-unzip-outer.ngrok-free.de/project",
      },
      {
        source: "/project/:path*",
        destination:
          "https://decorated-unzip-outer.ngrok-free.de/project/:path*",
      },
    ];
  },
};

export default nextConfig;
