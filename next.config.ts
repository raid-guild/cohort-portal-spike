import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Reduce worker concurrency in constrained CI environments.
  experimental: {
    cpus: 2,
  },
};

export default nextConfig;
