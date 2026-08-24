import { SignUp } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  return (
    <div className="login-screen">
      <div className="login-glow"></div>
      <img className="login-bg-logo" src="/logo-escenari.png" alt="" />
      <div className="auth-box">
        <div className="login-logo-row">
          <img className="login-logo-img" src="/logo-escenari.png" alt="Escenari" />
        </div>
        <SignUp appearance={clerkAppearance} fallbackRedirectUrl="/onboarding" signInFallbackRedirectUrl="/resum" />
      </div>
      <div className="login-copyright">© {new Date().getFullYear()} Escenari</div>
    </div>
  );
}
