import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*", "localhost", "127.0.0.1", "172.29.128.1"],
} as any;

export default nextConfig;
