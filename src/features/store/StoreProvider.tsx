"use client";

import { createContext, useContext, useMemo,useEffect,useState, useSyncExternalStore, type ReactNode } from "react";
import {savedStorage,emptySaved} from './saved-state';

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
function DemoStoreProvider({ children, demo }: { children: ReactNode; demo: boolean }) {
  const storage = useMemo(() => makeStorage(demo), [demo]);
  const state = useSyncExternalStore(subscribe, storage.get, () => empty);
  return <Context.Provider value={{...state, ...storage, demo}}>{children}</Context.Provider>;
}
const notify=()=>window.dispatchEvent(new Event(change));
async function storageLock<T>(work:()=>T|Promise<T>):Promise<T> {
  return navigator.locks?navigator.locks.request('roomlet-saved-items',work):work();
}
function SavedStoreProvider({children,accountId}:{children:ReactNode;accountId:string|null}) {
  const [error,setError]=useState('');
  const storage=useMemo(()=>savedStorage({getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)},accountId),[accountId]);
  const state=useSyncExternalStore(subscribe,storage.get,()=>emptySaved);
  useEffect(()=>{
    let stopped=false,sending=false,timer:ReturnType<typeof setTimeout>|undefined;
    async function sync(){
      if(!accountId||sending||stopped)return;
      sending=true;
      try {
        const operations=storage.pending();
        const response=await fetch('/api/profile/saved',{method:'POST',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId,operations})});
        if(!response.ok)throw Error();
        const data=await response.json();
        if(stopped||data.accountId!==accountId)return;
        await storageLock(()=>{storage.ack(operations.map(op=>op.id),data.state);notify();});
        setError('');
      } catch{if(!stopped)setError('Изменения остаются на этом устройстве. Синхронизация повторится при подключении.');}
      finally{sending=false;if(!stopped&&storage.pending().length)timer=setTimeout(sync,10000);}
    }
    function changed(){if(storage.pending().length){clearTimeout(timer);timer=setTimeout(sync,300);}}
    void storageLock(()=>{
      if(!localStorage.getItem('roomlet.saved.v2:migrated')) {
        const legacy=JSON.parse(localStorage.getItem('roomlet.favorites.v1')||'{}');
        if(Array.isArray(legacy.favorites))for(const slug of legacy.favorites)if(typeof slug==='string')storage.favorite(slug,true);
        localStorage.setItem('roomlet.saved.v2:migrated','yes');
      }
      storage.claimGuest();notify();
    }).then(sync).catch(()=>setError('Не удалось сохранить данные на устройстве. Проверьте доступ к хранилищу браузера.'));
    window.addEventListener(change,changed);window.addEventListener('storage',changed);window.addEventListener('online',sync);window.addEventListener('focus',sync);
    return()=>{stopped=true;clearTimeout(timer);window.removeEventListener(change,changed);window.removeEventListener('storage',changed);window.removeEventListener('online',sync);window.removeEventListener('focus',sync);};
  },[accountId,storage]);
  function mutate(work:()=>void){void storageLock(()=>{work();notify();}).catch(()=>setError('Не удалось сохранить изменения на устройстве.'));}
  const value:Store={...state,orders:[],briefs:[],demo:false,get:()=>({...storage.get(),orders:[],briefs:[]}),
    toggleFavorite:slug=>mutate(()=>storage.favorite(slug,!storage.get().favorites.includes(slug))),
    addLine:line=>mutate(()=>storage.cart(line,true)),
    removeLine:id=>mutate(()=>{const line=storage.get().cart.find(item=>lineKey(item)===id);if(line)storage.cart(line,false);}),
    submitRequest:()=>{},addBrief:()=>{},
  };
  return <Context.Provider value={value}>{children}{error&&<p className="store-small" role="status">{error}</p>}</Context.Provider>;
}
export function StoreProvider({children,demo,accountId=null}:{children:ReactNode;demo:boolean;accountId?:string|null}) {
  return demo?<DemoStoreProvider demo={demo}>{children}</DemoStoreProvider>:<SavedStoreProvider accountId={accountId}>{children}</SavedStoreProvider>;
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error("StoreProvider is required");
  return value;
}
