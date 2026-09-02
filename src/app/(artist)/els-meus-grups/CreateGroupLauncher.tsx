"use client";

import { useState } from "react";
import CreateGroupModal from "@/components/CreateGroupModal";

// "Crea el teu grup" per a un músic sense grup propi: en crear-lo passa a
// gestionar-lo i hi toca alhora.
export default function CreateGroupLauncher({ selfName, selfInstruments }: { selfName: string; selfInstruments: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="panel cg-launcher">
      <div>
        <div className="panel-title" style={{ marginBottom: 4 }}>Tens el teu propi grup?</div>
        <div className="t-dim" style={{ fontSize: 13, lineHeight: 1.5 }}>
          Crea&apos;l aquí: en seràs músic i gestor alhora — bolos, full de ruta, repertori, facturació i tot el que veu una agència, per al teu grup.
        </div>
      </div>
      <button type="button" className="glow-cta" onClick={() => setOpen(true)}>+ Crea el teu grup</button>
      {open && <CreateGroupModal mode="musician" selfName={selfName} selfInstruments={selfInstruments} onClose={() => setOpen(false)} />}
    </div>
  );
}
