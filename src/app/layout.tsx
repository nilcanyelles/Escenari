import type { Metadata } from "next";
import "../../style.css";

export const metadata: Metadata = {
  title: "Escenari",
  description: "Gestió d'actuacions musicals",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca">
      <body>{children}</body>
    </html>
  );
}
