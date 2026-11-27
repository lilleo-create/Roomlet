import "server-only";
import { createClient } from "@supabase/supabase-js";
import { localDemoEnabled, supabaseConfig } from "@/lib/supabase/config";

function invitationSettings() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const site = process.env.ROOMLET_SITE_URL;
  if (localDemoEnabled() || process.env.ROOMLET_EMAIL_INVITES !== "true" || !key || !site) return null;
  try {
    const url = new URL(site);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return { key, redirectTo: new URL("/studio/invitation", url).href };
  } catch {
    return null;
  }
}

export function canSendTeamInvites() {
  return invitationSettings() !== null;
}

export async function sendTeamInvite(email: string) {
  const settings = invitationSettings();
  if (!settings) return "mail-unavailable" as const;
  const { url } = supabaseConfig();
  const admin = createClient(url, settings.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: settings.redirectTo });
  if (!error) return "invited" as const;
  if (error.code === "email_exists" || error.code === "user_already_exists") return "registered" as const;
  return "mail-error" as const;
}
