"use client";

import { useEffect, useState } from "react";
import { observeClock, type DeviceClock } from "./clock";

export function useClock() {
  const [clock, setClock] = useState<DeviceClock | null>(null);
  useEffect(() => observeClock(setClock), []);
  return clock;
}
