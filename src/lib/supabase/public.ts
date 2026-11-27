import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

import { requireAccountStaff, wantsShowcase } from "@/features/studio/session";
import { showcaseClient } from "./showcase";

// Deliberately independent of the request session, even when the visitor is a maker.
export async function createCatalogClient() {
  if (await wantsShowcase()) {
    await requireAccountStaff();
    return showcaseClient();
  }
  const {url,key} = supabaseConfig();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {fetch: (input, init) => fetch(input, {...init, cache:"no-store"})},
  });
}
