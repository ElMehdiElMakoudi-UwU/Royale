import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image on the VPS.
  output: "standalone",
  experimental: {
    // Delivery-note photos are resized in the browser (~0.5 MB each), several sheets per upload.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
