import { useSyncExternalStore } from "react";
import { availableStarts, todayInStudio, validDate, windowLabel } from "./calendar";

const STORAGE_KEY = "roomlet.demo.blocked-days.v1";
const EVENT = "roomlet:availability-change";
const empty = () => "[]";
function snapshot(): string {
  try { return window.localStorage.getItem(STORAGE_KEY) ?? "[]"; }
  catch { return "[]"; }
}
function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(EVENT, notify);
  window.addEventListener("focus", notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(EVENT, notify);
    window.removeEventListener("focus", notify);
  };
}
export function decodeBlocks(raw: string): string[] {
  try {
    const values: unknown = JSON.parse(raw);
    return Array.isArray(values) ? values.filter((v): v is string => typeof v === "string" && validDate(v)) : [];
  } catch { return []; }
}
export function useBlockedDates(): string[] {
  return decodeBlocks(useSyncExternalStore(subscribe, snapshot, empty));
}
export function toggleBlock(day: string): boolean {
  if (!validDate(day)) return false;
  const previous = decodeBlocks(snapshot());
  const next = previous.includes(day) ? previous.filter((key) => key !== day) : [...previous, day];
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
  catch { return false; }
  window.dispatchEvent(new Event(EVENT));
  return true;
}
export function isAvailableWindowLabel(label: string): boolean {
  return availableStarts(todayInStudio(), decodeBlocks(snapshot())).some((key) => windowLabel(key) === label);
}
