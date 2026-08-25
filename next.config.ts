import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle for a small production Docker image.
  output: "standalone",
  // Media (thumbnails / samples / originals / transcodes) is served by the Artemis
  // media gateway as HTTP URLs derived from Apollo. Allow remote images from it.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
