import { redirect } from "next/navigation";
import { localDemoEnabled } from "@/lib/supabase/config";
import { readAccount } from "./session";
import { webTelegramEnabled } from "@/lib/telegram/config.server";
import { EmailForm } from "./EmailForm";
import { authDestination, type AuthMode, type AuthQuery } from "./auth-paths";
import "./auth.css";

export async function EmailScreen({ mode, query }: { mode: AuthMode; query: AuthQuery }) {
  const next = authDestination(query.next);
  const reauth = ["/mini/link","/profile/telegram"].includes(next);
  if ((mode === "login" || mode === "register") && !(mode === "login" && reauth) && await readAccount()) redirect(next);
  const code = typeof query.code === "string" && /^[\w.-]{8,1024}$/.test(query.code) ? query.code : undefined;
  const localProof = localDemoEnabled() && typeof query.local_proof === "string" && /^[a-zA-Z0-9_-]{32,256}$/.test(query.local_proof) ? query.local_proof : undefined;
  return <EmailForm miniAvailable={webTelegramEnabled() && !reauth} telegramError={query.telegram === "error"} localProof={localProof} mode={mode} next={next} code={code}
    flowId={typeof query.sb_flow_id === "string" ? query.sb_flow_id.slice(0, 65) : undefined} recovered={mode === "login" && query.success === "recovered"}
    demo={localDemoEnabled()} invalidLink={Boolean(query.error || query.error_code || query.code && !code)} />;
}
