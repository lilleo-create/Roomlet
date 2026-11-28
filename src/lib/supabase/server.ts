import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";
import { hasMiniSession, miniCookieOptions } from "./mini-cookies";

export async function createRoomletClient(context: "account" | "recovery" | "telegram" | "web" = "account") {
  const jar = await cookies();
  const {url,key} = supabaseConfig();
  return createServerClient(url,key,{
    ...(context === "recovery" ? { cookieOptions: { name: "roomlet-recovery", path: "/profile", httpOnly: true, sameSite: "lax" as const } }
      : context === "telegram" || context!=='web' && hasMiniSession(jar.getAll()) ? {cookieOptions: miniCookieOptions} : {}),
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          for (const {name,value,options} of values) jar.set(name,value,options);
        } catch {
          // Server Components cannot write cookies; the Studio proxy refreshes them.
        }
      },
    },
    global: {fetch:(input,init)=>fetch(input,{...init,cache:"no-store"})},
  });
}
