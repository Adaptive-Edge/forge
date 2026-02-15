import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Turbopack due to path issue
  experimental: {
    // Use webpack instead
  }
};

export default nextConfig;
