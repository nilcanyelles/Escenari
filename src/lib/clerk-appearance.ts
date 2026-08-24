// Aparença compartida dels components de Clerk perquè encaixin amb el tema
// fosc blau/porpra de l'app.
export const clerkAppearance = {
  variables: {
    colorPrimary: "#8b7bff",
    colorBackground: "#14151f",
    colorInputBackground: "#0e0f17",
    colorText: "#eceafa",
    colorTextSecondary: "#9b98b8",
    colorInputText: "#eceafa",
    colorDanger: "#ff6b81",
    borderRadius: "12px",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  elements: {
    card: { boxShadow: "0 24px 80px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)" },
    headerTitle: { color: "#eceafa" },
    socialButtonsBlockButton: {
      border: "1px solid rgba(255,255,255,0.12)",
      color: "#eceafa",
    },
  },
} as const;
