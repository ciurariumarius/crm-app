import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/vault",
        destination: "/partners",
        permanent: true,
      },
      {
        source: "/vault/sites",
        destination: "/domains",
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
