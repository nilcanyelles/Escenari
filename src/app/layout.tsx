import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { caES } from "@clerk/localizations";
import { getCustomInstruments } from "@/lib/custom-instruments";
import { registerCustomInstruments } from "@/lib/tags";
import InstrumentRegistry from "@/components/InstrumentRegistry";
import "../../style.css";

export const metadata: Metadata = {
  title: "Escenari",
  description: "Gestió d'actuacions musicals",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Instruments personalitzats: es registren al servidor i al client perquè
  // instrumentIconFor() en trobi la icona a tot arreu.
  const customInstruments = await getCustomInstruments();
  registerCustomInstruments(customInstruments);
  return (
    <ClerkProvider localization={caES}>
      <html lang="ca">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
          />
        </head>
        <body>
          <InstrumentRegistry items={customInstruments} />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
