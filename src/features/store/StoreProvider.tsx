"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { findProduct } from "./products";

export type PurchaseMode = "ready" | "made";
export type Line = { slug: string; mode: PurchaseMode; window: string | null };
export type Request = { id: string; date: string; lines: Line[]; method: string };
export type CustomBrief = { id: string; idea: string; budget: string; deadline: string; reference: string };
type State = { favorites: string[]; cart: Line[]; orders: Request[]; briefs: CustomBrief[] };
const empty: State = { favorites: [], cart: [], orders: [], briefs: [] };
const key = "roomlet.store.v1";
let lastRaw: string | null = null;
let cached = empty;
let volatileOnly = false;
const change = "roomlet-store-update";

function isLine(line: unknown): line is Line {
  if (!line || typeof line !== "object" || !("slug" in line) || typeof line.slug !== "string" || !("mode" in line) || !("window" in line)) return false;
  const product = findProduct(line.slug);
  return !!product && ((line.mode === "ready" && product.ready && line.window === null)
    || (line.mode === "made" && product.made && typeof line.window === "string"));
}

function read(): State {
  if (volatileOnly) return cached;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === lastRaw) return cached;
    lastRaw = raw;
    cached = empty;
    if (raw) {
      const value = JSON.parse(raw);
      cached = {
        favorites: Array.isArray(value.favorites) ? value.favorites.filter((slug: unknown) => typeof slug === "string" && findProduct(slug)) : [],
        cart: Array.isArray(value.cart) ? value.cart.filter(isLine) : [],
        orders: Array.isArray(value.orders) ? value.orders.filter((o: Request | null) => o && typeof o.id === "string" && typeof o.date === "string" && Array.isArray(o.lines) && o.lines.every(isLine) && typeof o.method === "string") : [],
        briefs: Array.isArray(value.briefs) ? value.briefs.filter((b: CustomBrief | null) => b && [b.id, b.idea, b.budget, b.deadline, b.reference].every(v => typeof v === "string")) : [],
      };
    }
  } catch { /* A private browser or invalid snapshot can still use the local demo. */ }
  return cached;
}

function update(next: State) {
  cached = next;
  lastRaw = JSON.stringify(next);
  try { window.localStorage.setItem(key, lastRaw); }
  catch { volatileOnly = true; }
  window.dispatchEvent(new Event(change));
}

function subscribe(notify: () => void) {
  window.addEventListener(change, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(change, notify);
    window.removeEventListener("storage", notify);
  };
}

export function lineKey(line: Line) {
  return [line.slug, line.mode, line.window ?? ""].join(":");
}

const actions = {
  toggleFavorite(slug: string) {
    const state = read();
    const favorites = state.favorites.includes(slug) ? state.favorites.filter(s => s !== slug) : [...state.favorites, slug];
    update({ ...state, favorites });
  },
  addLine(line: Line) {
    const state = read();
    if (!isLine(line) || state.cart.some(item => lineKey(item) === lineKey(line))) return;
    update({ ...state, cart: [...state.cart, line] });
  },
  removeLine(id: string) {
    const state = read();
    update({ ...state, cart: state.cart.filter(line => lineKey(line) !== id) });
  },
  submitRequest(method: string) {
    const state = read();
    if (!state.cart.length) return;
    const order = { id: crypto.randomUUID(), date: new Date().toISOString(), lines: state.cart, method };
    update({ ...state, orders: [order, ...state.orders], cart: [] });
  },
  addBrief(brief: Omit<CustomBrief, "id">) {
    const state = read();
    update({ ...state, briefs: [{ ...brief, id: crypto.randomUUID() }, ...state.briefs] });
  },
};

const Context = createContext({ ...empty, ...actions });

export function StoreProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, read, () => empty);
  return <Context.Provider value={{ ...state, ...actions }}>{children}</Context.Provider>;
}

export function useStore() {
  return useContext(Context);
}
