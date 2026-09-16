"use client";

import { useState } from "react";
import CreateGroupModal from "@/components/CreateGroupModal";

// "Crea el teu grup" per a un músic: en crear-lo hi entra com a músic amb
// permís d'Admin (control total d'aquest grup), sense deixar de ser músic
// —amb els seus permisos— a la resta de grups on ja fos.
export default function CreateGroupLauncher({ selfName, selfInstruments }: { selfName: string; selfInstruments: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="panel cg-launcher">
      <div>
        <div className="panel-title" style={{ marginBottom: 4 }}>Tens el teu propi grup?</div>
        <div className="t-dim" style={{ fontSize: 13, lineHeight: 1.5 }}>
          Crea&apos;l aquí: en tindràs el control total (equip, repertori, riders, codi d&apos;unió…), sense deixar de ser músic dels teus altres grups.
        </div>
      </div>
      <button type="button" className="glow-cta" onClick={() => setOpen(true)}>+ Crea el teu grup</button>
      {open && <CreateGroupModal mode="musician" selfName={selfName} selfInstruments={selfInstruments} onClose={() => setOpen(false)} />}
    </div>
  );
}
