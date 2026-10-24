import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [
          {
            protocol: "https",
            hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
            pathname: "/storage/v1/object/public/media/**",
          },
        ]
      : [],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 480],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
