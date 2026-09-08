// Tick lila de "compte d'Escenari vinculat" — el mateix a tot arreu on
// surt una persona (targetes d'equip, llistes d'assistència, repartiment,
// "qui ve", pàgina pública, perfil, agència...), perquè es reconegui d'un
// cop d'ull qui pot entrar a l'app amb el seu compte.
export default function VerifiedTick({ size = 13, title = "Té compte d'Escenari vinculat", className = "" }: {
  size?: number;
  title?: string;
  className?: string;
}) {
  return (
    <svg
      className={("verified-badge " + className).trim()} width={size} height={size} style={{ width: size, height: size }}
      viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title}
    >
      <title>{title}</title>
      <path d="M12 1l2.6 2.02 3.3-.34 1.02 3.16 3.02 1.46-.66 3.28 2.02 2.62-2.02 2.62.66 3.28-3.02 1.46-1.02 3.16-3.3-.34L12 23l-2.6-2.02-3.3.34-1.02-3.16-3.02-1.46.66-3.28L.7 11.8l2.02-2.62-.66-3.28 3.02-1.46 1.02-3.16 3.3.34L12 1z"></path>
      <path d="M8.5 12.3l2.4 2.4 4.6-4.9" stroke="#0b0a14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"></path>
    </svg>
  );
}
