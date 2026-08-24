import { dark } from "@clerk/themes";

// Tema fosc oficial de Clerk (contrast correcte a tots els subelements) amb
// els accents blau/porpra de l'app per sobre.
export const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: "#8b7bff",
    colorBackground: "#181926",
    colorInputBackground: "#0e0f17",
    colorDanger: "#ff6b81",
    borderRadius: "12px",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  elements: {
    card: { boxShadow: "0 24px 80px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)" },
  },
};
