import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },

  // Reduce worker concurrency in constrained CI environments.
  experimental: {
    cpus: 2,
  },
};

export default nextConfig;
