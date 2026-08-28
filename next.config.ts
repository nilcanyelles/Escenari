import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Pujada de fitxers (gravacions, PDFs, backing tracks…) via server actions.
      // Els àudios de backing track es permeten fins a 100 MB, per això el marge.
      bodySizeLimit: "120mb",
    },
    // Com que hi ha middleware (Clerk) actiu a totes les rutes, Next també
    // limita per separat el cos de les peticions que hi passen — per
    // defecte només 10 MB, per sota del límit real per fitxer.
    middlewareClientMaxBodySize: "120mb",
  },
};

export default nextConfig;
