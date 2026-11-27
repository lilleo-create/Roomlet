import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { cleanDemo, seedDemo } from "./seed.mjs";

const apiHost = "127.0.0.1";
const apiPort = 54331;
const apiURL = `http://${apiHost}:${apiPort}`;
const state = resolve(".roomlet-demo");
const credentialsPath = resolve(state, "credentials.json");
const command = process.argv[2] || "dev";
if (!["dev", "api", "seed", "clean"].includes(command)) throw new Error("Expected dev, api, seed or clean");
if (process.env.NODE_ENV === "production") throw new Error("This command is for local development only.");
await mkdir(state, {recursive:true});

async function credentials() {
  try { return JSON.parse(await readFile(credentialsPath, "utf8")); }
  catch (e) { if (e.code !== "ENOENT") throw e; }
  const secret = () => randomBytes(32).toString("base64url");
  const keys = {email:"maker@roomlet.local", password:secret(), jwtSecret:secret(),
    publishableKey:"sb_publishable_"+secret(), serviceKey:"sb_secret_"+secret(), maintenanceKey:secret()};
  try { await writeFile(credentialsPath, JSON.stringify(keys), {flag:"wx", mode:0o600}); }
  catch (e) { if (e.code==="EEXIST") return JSON.parse(await readFile(credentialsPath,"utf8")); throw e; }
  return keys;
}
const keys = await credentials();

const actionPath = "/_roomlet_demo/";
async function requestMaintenance() {
  try {
    const response = await fetch(apiURL + actionPath + command, {method:"POST", redirect:"error", headers:{"x-demo-key":keys.maintenanceKey}});
    if (!response.ok) throw new Error("Local demo command failed: " + await response.text());
    console.log(await response.text());
    return true;
  } catch(error) {
    if (error.cause?.code === "ECONNREFUSED") return false;
    throw error;
  }
}
const maintenance = command==="seed" || command==="clean";
if (maintenance && await requestMaintenance()) process.exit(0);

let listener = (_req,res) => {res.writeHead(503).end("Starting local demo");};
const apiServer = createServer((req,res)=>listener(req,res));
// Reserve the port before opening a PGlite data directory. Concurrent launches may not
// initialize a second connection to the same store. No CLI accepts a URL for a hosted project.
await new Promise((ok,fail)=>apiServer.once("error",fail).listen(apiPort,apiHost,ok));
let connection;
let closeWeb;
async function close() {
  await closeWeb?.();
  apiServer.close();
  await connection?.close();
}

try {
  Object.assign(process.env, {EXPERIMENTAL_STORAGE:"1", ROOMLET_DEMO_JWT_SECRET:keys.jwtSecret,
    ROOMLET_DEMO_PUBLISHABLE_KEY:keys.publishableKey, ROOMLET_DEMO_SERVICE_KEY:keys.serviceKey});
  const { createApi } = await import("@supabase/lite/cli");
  // The Lite CLI also supports its own hosted service; this preview only opens the local app.
  const api = await createApi({root:state,authStorage:{getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{}}});
  const app = await api.project.local.createApp("supabase/demo/config.toml",{admin:false});
  connection = app.connection;
  await app.ensureSystemSchema();
  const db = connection.driver;
  // A fresh Lite PostgreSQL cluster provides auth.uid() and Storage tables. Add the
  // standard PostgREST roles and Storage grants before applying the hosted migration.
  await db.exec(`do $$ begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  end $$;
  grant usage on schema auth,storage to anon,authenticated,service_role;
  grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
  grant select on storage.buckets to anon,authenticated,service_role;
  alter table storage.objects enable row level security;`);
  const {migratePreview} = await import("./migrate.mjs");
  await migratePreview(db);
  await connection.clearSchemaCache();
  const localClient = app.getClient({apikey:keys.publishableKey,auth:{persistSession:false,autoRefreshToken:false}});
  const found=(await db.query("select id from auth.users where email=$1", [keys.email])).rows[0];
  if (!found) {
    const {data,error}=await localClient.auth.signUp({email:keys.email,password:keys.password});
    if(error || !data.user?.id) throw error || new Error("Could not create demo maker");
    await db.query("update public.profiles set role='maker' where id=$1",[data.user.id]);
  }
  const storage = app.getClient({apikey:keys.serviceKey,auth:{persistSession:false,autoRefreshToken:false}}).storage;
  const execute = async (action) => {
    if (action==="clean") await cleanDemo(db,storage); else await seedDemo(db,storage);
    return action==="clean" ? "Demo collection removed." : "Demo collection seeded.";
  };
  if (maintenance) {
    console.log(await execute(command)); await close();
  } else {
    if (!(await db.query("select 1 from roomlet_private.demo_seed_state where name='initialized'")).rows.length) await execute("seed");
    let busy=false;
    listener = getRequestListener(async(request, env) => {
      const url=new URL(request.url);
      if(url.host!==`${apiHost}:${apiPort}` && url.host!==`localhost:${apiPort}`) return new Response(null,{status:403});
      if(url.pathname.startsWith(actionPath)) {
        const given=Buffer.from(request.headers.get("x-demo-key")||"");
        const expected=Buffer.from(keys.maintenanceKey);
        if(request.method!=="POST" || given.length!==expected.length || !timingSafeEqual(given,expected)) return new Response(null,{status:403});
        const action=url.pathname.slice(actionPath.length);
        if(!["seed","clean"].includes(action)) return new Response(null,{status:404});
        if(busy) return new Response("Another demo command is running.",{status:409});
        busy=true;
        try{return new Response(await execute(action));} catch(e){console.error(e.message);return new Response("Operation failed.",{status:500});} finally{busy=false;}
      }
      const rest=/^\/rest\/v1\/(?:rpc\/)?[a-z][a-z0-9_]*$/.test(url.pathname);
      const auth=/^\/auth\/v1\/(token|logout|user)$/.test(url.pathname);
      const media=url.pathname.startsWith("/storage/v1/object/");
      if(!rest && !auth && !media) return new Response(null,{status:404});
      if(request.headers.get("apikey")!==keys.publishableKey && !(media && request.method==="GET" && url.pathname.startsWith("/storage/v1/object/sign/") && url.searchParams.has("token"))) {
        return new Response(null,{status:401});
      }
      return app.fetch(request,{peerAddress:env.incoming.socket.remoteAddress});
    }, {overrideGlobalObjects:false});
    console.log("Roomlet demo API:",apiURL);
    if(command==="dev"){
      const { startPreviewWeb } = await import("./web.mjs");
      closeWeb = await startPreviewWeb(keys.publishableKey);
    }
    process.once("SIGINT",()=>close().then(()=>process.exit(0)));
    process.once("SIGTERM",()=>close().then(()=>process.exit(0)));
  }
} catch(error) {
  await close();
  console.error(error.stack || error);
  process.exitCode=1;
}
