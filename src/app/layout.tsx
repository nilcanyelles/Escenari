import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { caES } from "@clerk/localizations";
import { getCustomInstruments } from "@/lib/custom-instruments";
import { resetCustomInstruments } from "@/lib/tags";
import InstrumentRegistry from "@/components/InstrumentRegistry";
import "../../style.css";

export const metadata: Metadata = {
  title: "Escenari",
  description: "Gestió d'actuacions musicals",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Instruments personalitzats: només els del compte que fa la petició. Es
  // buida el registre abans d'omplir-lo (resetCustomInstruments) perquè un
  // procés Node reutilitzat entre peticions (habitual a producció) no hi
  // deixi acumulats els d'un compte d'una petició anterior.
  const { userId } = await auth();
  const customInstruments = await getCustomInstruments(userId);
  resetCustomInstruments(customInstruments);
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
