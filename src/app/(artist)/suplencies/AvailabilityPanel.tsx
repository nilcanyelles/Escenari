"use client";

import { useState } from "react";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import { setDayAvailabilityAction } from "../actions";

// El calendari de disponibilitat del músic, editable: cada clic es desa sol.
export default function AvailabilityPanel({ availability: initial, busy, today }: {
  availability: Record<string, boolean>;
  busy: Record<string, string>;
  today: string;
}) {
  const [availability, setAvailability] = useState(initial);
  return (
    <div className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-title" style={{ marginBottom: 4 }}>El teu calendari de disponibilitat</div>
      <div className="t-dim" style={{ fontSize: 12.5, marginBottom: 12 }}>
        Toca un dia per marcar-te disponible (verd) o no disponible (vermell); un altre toc ho treu. Els dies amb bolo es
        marquen sols en vermell — els gestors veuen que no hi ets, però no quin bolo tens.
      </div>
      <AvailabilityCalendar
        availability={availability} busy={busy} editable today={today}
        onToggle={async (day, next) => {
          setAvailability((prev) => {
            const n = { ...prev };
            if (next === null) delete n[day]; else n[day] = next;
            return n;
          });
          await setDayAvailabilityAction(day, next);
        }}
      />
    </div>
  );
}
