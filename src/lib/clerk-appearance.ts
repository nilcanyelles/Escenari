import { dark } from "@clerk/themes";

// Tema fosc per als components de Clerk. Es defineixen els colors amb els
// noms de variable nous I els antics (Clerk els va renombrar el 2025) perquè
// el resultat sigui idèntic amb qualsevol versió del runtime — sense text
// fosc sobre fons fosc.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const clerkAppearance: any = {
  baseTheme: dark,
  variables: {
    colorPrimary: "#8b7bff",
    colorBackground: "#171827",
    // Text principal i secundari (nou / antic)
    colorForeground: "#eceafa",
    colorText: "#eceafa",
    colorMutedForeground: "#a5a3c2",
    colorTextSecondary: "#a5a3c2",
    // Inputs (nou / antic)
    colorInput: "#0d0e17",
    colorInputBackground: "#0d0e17",
    colorInputForeground: "#eceafa",
    colorInputText: "#eceafa",
    // Text sobre el botó primari (nou / antic)
    colorPrimaryForeground: "#0d0e17",
    colorTextOnPrimaryBackground: "#0d0e17",
    colorNeutral: "#ffffff",
    colorDanger: "#ff6b81",
    borderRadius: "12px",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  elements: {
    card: { boxShadow: "0 24px 80px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.09)" },
    headerTitle: { color: "#eceafa" },
    headerSubtitle: { color: "#a5a3c2" },
    socialButtonsBlockButton: { border: "1px solid rgba(255,255,255,0.14)", color: "#eceafa" },
    socialButtonsBlockButtonText: { color: "#eceafa" },
    dividerText: { color: "#a5a3c2" },
    dividerLine: { background: "rgba(255,255,255,0.12)" },
    formFieldLabel: { color: "#c9c7e2" },
    footerActionText: { color: "#a5a3c2" },
    footerActionLink: { color: "#a99cff" },
  },
};
