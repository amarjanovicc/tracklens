import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Almost every route is per-user and dynamic, so Cache Components would add
  // Suspense ceremony without much benefit. Revisit for the marketing pages.
  serverExternalPackages: ["postgres"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co" },
      { protocol: "https", hostname: "*.spotifycdn.com" },
      { protocol: "https", hostname: "mosaic.scdn.co" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
