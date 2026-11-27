"use client";

import { useState } from "react";
import { useClock } from "@/features/booking/useClock";

export function WorkshopTimezone({ savedZone, zones }: { savedZone: string | null; zones: string[] }) {
  const clock = useClock();
  const [manualZone, setManualZone] = useState(savedZone);
  const detected = clock?.timeZone;
  const value = manualZone ?? detected ?? "";
  const options = detected && !zones.includes(detected) ? [detected, ...zones] : zones;
  return <label>Часовой пояс мастерской
    <select name="timezone" required value={value} onChange={event => setManualZone(event.target.value)}>
      {!value && <option value="">Определяем часовой пояс…</option>}
      {options.map(zone => <option key={zone} value={zone}>{zone}</option>)}
    </select>
    {detected && <small>Часовой пояс устройства · {detected}</small>}
  </label>;
}
