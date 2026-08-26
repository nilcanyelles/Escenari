import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { caES } from "@clerk/localizations";
import "../../style.css";

export const metadata: Metadata = {
  title: "Escenari",
  description: "Gestió d'actuacions musicals",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
