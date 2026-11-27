import "server-only";
import { Worker } from "node:worker_threads";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

type Connection = {url:string;key:string;email:string;password:string};
type Sandbox = { connection?: Promise<Connection>; staffToken?: Promise<{token:string; expires:number}> };
const singleton = globalThis as typeof globalThis & { roomletShowcase?: Sandbox };
const state = singleton.roomletShowcase ??= {};

function connect() {
  if (state.connection) return state.connection;
  // Only invoked after the current hosted account passes the workshop role check.
  state.connection = new Promise<Connection>((resolve,reject) => {
    const worker = new Worker(join(process.cwd(),"supabase/demo/runtime.mjs"), {
      execArgv: [], workerData:{mode:"roomlet-showcase"},
      env:{ PATH:process.env.PATH, SystemRoot:process.env.SystemRoot, TEMP:process.env.TEMP,
        TMP:process.env.TMP, TMPDIR:process.env.TMPDIR, HOME:process.env.HOME, NODE_ENV:"production" },
    });
    const timer = setTimeout(() => void worker.terminate(), 60000);
    const stopped = () => {
      clearTimeout(timer);
      state.connection = undefined;
      state.staffToken = undefined;
      reject(new Error("Не удалось запустить демонстрационную базу."));
    };
    worker.once("error", stopped);
    worker.once("exit", stopped);
    worker.once("message", message => {
      const config = message as Connection;
      if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(config.url) || !config.key || !config.password) {
        void worker.terminate(); return;
      }
      clearTimeout(timer);
      resolve(config);
    });
  });
  return state.connection;
}

const auth = { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false };
export async function showcaseClient(staff = false) {
  const {url,key,email,password} = await connect();
  const db = createClient(url,key,{auth,global:{fetch:(input,init)=>fetch(input,{...init,cache:"no-store"})}});
  if (!staff) return db;
  let cached = await state.staffToken;
  if (!cached || cached.expires < Date.now()/1000 + 60) {
    state.staffToken = db.auth.signInWithPassword({email,password}).then(({data,error})=>{
      if (error || !data.session) throw new Error("Демомастерская недоступна.");
      return {token:data.session.access_token, expires:data.session.expires_at ?? 0};
    }).catch(error=>{state.staffToken=undefined;throw error;});
    cached = await state.staffToken;
  }
  const token = cached.token;
  return createClient(url,key,{auth,accessToken:async()=>token,global:{fetch:(input,init)=>fetch(input,{...init,cache:"no-store"})}});
}
