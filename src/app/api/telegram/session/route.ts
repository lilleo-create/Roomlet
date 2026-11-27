import { createClient, isAuthSessionMissingError } from "@supabase/supabase-js";
import { createRoomletClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { issuerConfig, miniEnabled } from "@/lib/telegram/config.server";
import { createAssertion, provider, recentlyAuthenticated } from "@/lib/telegram/assertion.server";
import { verifyTelegramInitData } from "@/lib/telegram/init-data.server";

const reply = (status: number, result: string) => Response.json({result},{status,headers:{"Cache-Control":"private, no-store"}});

async function readLaunch(request: Request) {
  if (!request.body) throw Error();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const {value,done} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) { await reader.cancel(); throw Error(); }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally { reader.releaseLock(); }
}

export async function POST(request: Request) {
  if (!miniEnabled()) return reply(503,"disabled");
  try {
    const {origin,keys} = issuerConfig();
    const intent = request.headers.get("x-roomlet-intent");
    if (request.headers.get("origin") !== origin || (intent !== "login" && intent !== "link")) return reply(403,"invalid");
    const botToken = process.env.ROOMLET_TELEGRAM_BOT_TOKEN;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!secret || !botToken) return reply(503,"configuration");
    let launch;
    try { launch = verifyTelegramInitData(await readLaunch(request), botToken); }
    catch { return reply(401,"invalid"); }
    const client = await createRoomletClient();
    const {data:{user},error} = await client.auth.getUser();
    if (error && !isAuthSessionMissingError(error)) return reply(401,"session");
    if (intent === "login" && user) {
      const identity = user.identities?.find(identity => identity.provider === provider);
      if (identity && identity.identity_data?.sub !== "tg:"+launch.telegramId) return reply(409,"conflict");
      return reply(200,"existing");
    }
    if (intent === "link") {
      if (!user || !user.email || request.headers.get("x-roomlet-account") !== user.id) return reply(401,"reauth");
      const {data} = await client.auth.getClaims();
      if (data?.claims.sub !== user.id || !recentlyAuthenticated(data.claims.amr)) return reply(401,"reauth");
      const current = user.identities?.find(identity => identity.provider === provider);
      if (current) return current.identity_data?.sub === "tg:"+launch.telegramId ? reply(200,"linked") : reply(409,"conflict");
    }

    const {url} = supabaseConfig();
    const server = createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const used = await server.rpc("consume_telegram_launch", {proof_hash:launch.replayKey,valid_until:new Date(launch.expiresAt*1000).toISOString()});
    if (used.error) return reply(503,"storage");
    if (used.data !== true) return reply(409,"reopen");
    const credentials = createAssertion(launch,origin,keys);
    const result = intent === "link" ? await client.auth.linkIdentity(credentials) : await client.auth.signInWithIdToken(credentials);
    if (result.error || !result.data.user || !result.data.session) {
      return result.error?.code === "identity_already_exists" ? reply(409,"conflict") : reply(503,"exchange");
    }
    if (intent === "link" && result.data.user.id !== user?.id) {
      await client.auth.signOut({scope:"local"});
      return reply(403,"session");
    }
    return reply(200,intent === "link" ? "linked" : "signed-in");
  } catch { return reply(503,"unavailable"); }
}
