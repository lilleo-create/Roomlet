import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";

export async function createRoomletClient() {
  const jar = await cookies();
  const {url,key} = supabaseConfig();
  return createServerClient(url,key,{
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
