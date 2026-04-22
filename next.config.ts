import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'bbscvofuqucsxvamkwnx.supabase.co',
      }
    ]
  }
};

export default nextConfig;
