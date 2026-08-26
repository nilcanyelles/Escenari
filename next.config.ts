import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Pujada de fitxers (gravacions, PDFs, memos de veu) via server actions.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
