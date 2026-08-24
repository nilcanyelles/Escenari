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
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
