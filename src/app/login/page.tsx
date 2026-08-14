import { loginAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="login-screen">
      <div className="login-glow"></div>
      <img className="login-bg-logo" src="/logo-escenari.png" alt="" />
      <form className="login-card" action={loginAction}>
        <input type="hidden" name="next" value={next || "/"} />
        <div className="login-logo-row">
          <img className="login-logo-img" src="/logo-escenari.png" alt="Escenari" />
        </div>
        <div className="login-form">
          <div className="field-group">
            <label className="field-label">Contrasenya</label>
            <input
              className="field-input"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              autoFocus
            />
          </div>
          <div className="login-error">{error ? "Contrasenya incorrecta." : ""}</div>
          <button type="submit" className="btn-primary">
            Entrar
          </button>
        </div>
      </form>
      <div className="login-copyright">© {new Date().getFullYear()} Escenari — Accés d&apos;administració</div>
    </div>
  );
}
