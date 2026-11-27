"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

export type PurchaseMode = "ready" | "made";
export type Line = { slug: string; mode: PurchaseMode; window: string | null };
type Order = { id: string; date: string; lines: Line[]; method: string };
type CustomBrief = { id: string; idea: string; budget: string; deadline: string; reference: string };
type State = { favorites: string[]; cart: Line[]; orders: Order[]; briefs: CustomBrief[] };
const empty: State = { favorites: [], cart: [], orders: [], briefs: [] };
const change = "roomlet-store-update";

export function lineKey(line: Line) {
  return [line.slug, line.mode, line.window ?? ""].join(":");
}

function isLine(item: unknown): item is Line {
  if (!item || typeof item !== "object" || !("slug" in item) || typeof item.slug !== "string") return false;
  if (!("mode" in item) || !("window" in item)) return false;
  return item.mode === "ready" && item.window === null || item.mode === "made" && typeof item.window === "string";
}
function parse(raw: string | null, demo: boolean): State {
  if (!raw) return empty;
  try {
    const value = JSON.parse(raw);
    const favorites = Array.isArray(value?.favorites) ? value.favorites.filter((v: unknown) => typeof v === "string") : [];
    if (!demo) return { ...empty, favorites };
    return {
      favorites, cart: Array.isArray(value.cart) ? value.cart.filter(isLine) : [],
      orders: Array.isArray(value.orders) ? value.orders.filter((o: Order) => o && typeof o.id === "string" && typeof o.date === "string" && typeof o.method === "string" && Array.isArray(o.lines) && o.lines.every(isLine)) : [],
      briefs: Array.isArray(value.briefs) ? value.briefs.filter((b: CustomBrief) => b && [b.id,b.idea,b.budget,b.deadline,b.reference].every(v => typeof v === "string")) : [],
    };
  } catch { return empty; }
}

function makeStorage(demo: boolean) {
  const key = demo ? "roomlet.store.v1" : "roomlet.favorites.v1";
  let previous: string | null = null;
  let state = empty;
  let volatile = false;
  function get() {
    if (!volatile) {
      try {
        const raw = localStorage.getItem(key);
        if (raw !== previous) { previous = raw; state = parse(raw, demo); }
      } catch { volatile = true; }
    }
    return state;
  }
  function set(next: State) {
    state = next;
    previous = JSON.stringify(demo ? next : {favorites: next.favorites});
    try { localStorage.setItem(key, previous); } catch { volatile = true; }
    window.dispatchEvent(new Event(change));
  }
  return {
    get,
    toggleFavorite(slug: string) {
      const s = get();
      set({...s, favorites: s.favorites.includes(slug) ? s.favorites.filter(id => id !== slug) : [...s.favorites, slug]});
    },
    addLine(line: Line) {
      const s = get();
      if (demo && isLine(line) && !s.cart.some(x => lineKey(x) === lineKey(line))) set({...s, cart: [...s.cart, line]});
    },
    removeLine(id: string) {
      const s = get();
      if (demo) set({...s, cart: s.cart.filter(x => lineKey(x) !== id)});
    },
    submitRequest(method: string) {
      const s = get();
      if (!demo || !s.cart.length) return;
      set({...s, cart: [], orders: [{id:crypto.randomUUID(), date:new Date().toISOString(), lines:s.cart, method}, ...s.orders]});
    },
    addBrief(brief: Omit<CustomBrief,"id">) {
      const s = get();
      if (demo) set({...s, briefs: [{...brief, id:crypto.randomUUID()}, ...s.briefs]});
    },
  };
}
function subscribe(fn: () => void) {
  window.addEventListener(change, fn); window.addEventListener("storage", fn);
  return () => { window.removeEventListener(change, fn); window.removeEventListener("storage", fn); };
}
type Store = State & ReturnType<typeof makeStorage> & {demo: boolean};
const Context = createContext<Store | null>(null);
export function StoreProvider({ children, demo }: { children: ReactNode; demo: boolean }) {
  const storage = useMemo(() => makeStorage(demo), [demo]);
  const state = useSyncExternalStore(subscribe, storage.get, () => empty);
  return <Context.Provider value={{...state, ...storage, demo}}>{children}</Context.Provider>;
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error("StoreProvider is required");
  return value;
}
