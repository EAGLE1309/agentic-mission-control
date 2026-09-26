import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The Tools page is a section of Integrations now (design §6.8).
      { source: "/tools", destination: "/integrations", permanent: true },
    ];
  },
};

export default nextConfig;
