import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { createClient } from "@supabase/supabase-js";

// Exercise the disposable instance only. No hosted URL or credentials are accepted.
const runtime = fileURLToPath(new URL("../../supabase/demo/runtime.mjs", import.meta.url));
const env = { PATH:process.env.PATH, TEMP:tmpdir(), TMPDIR:tmpdir(), NODE_ENV:"production" };
if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
if (process.env.HOME) env.HOME = process.env.HOME;
const server = process.platform === "linux"
  ? fork(runtime, ["showcase"], {env, execArgv:[], stdio:["ignore","ignore","inherit","ipc"]})
  : new Worker(runtime, {workerData:{mode:"roomlet-showcase"}, env});
function result(response) {
  if (response.error) throw new Error(response.error.message);
  return response.data;
}
try {
  const [config] = await once(server, "message", { signal:AbortSignal.timeout(60000) });
  assert.match(config.url, /^http:\/\/127\.0\.0\.1:\d+$/);
  const db = createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false}});
  result(await db.auth.signInWithPassword({email:config.email,password:config.password}));
  const catalog = async () => result(await db.rpc("roomlet_catalog"));
  assert.equal((await catalog()).length,4);
  const id = randomUUID();
  const path = id + "/" + randomUUID() + ".webp";
  const bytes = await readFile(new URL("../../assets/demo/catalog/night-library.webp",import.meta.url));
  result(await db.storage.from("product-media").upload(path,bytes,{contentType:"image/webp"}));
  const category = result(await db.from("categories").select("id").limit(1).single());
  const product = { slug:"qa-"+id, title:"Проверка фотографии", description:"", category_id:category.id,
    dimensions:"", materials:"", ready_quantity:1, currency:"RUB", price_minor:650000,
    cost_minor:100000, planned_minutes:60, made_to_order:false, requires_sketch:false,
    media:[{storage_path:path, sort_order:0, alt_text:"Миниатюра"}] };
  let expected = null;
  for (const status of ["draft","published","archived"]) {
    assert.equal(result(await db.rpc("save_product",{p_id:id,p_data:{...product,status,expected_updated_at:expected}})),id);
    const row = result(await db.from("products").select("status,updated_at").eq("id",id).single());
    assert.equal(row.status,status);
    expected=row.updated_at;
    assert.equal((await catalog()).some(entry=>entry.id===id),status==="published");
  }
  result(await db.rpc("delete_product",{p_id:id,p_expected_updated_at:expected}));
  result(await db.storage.from("product-media").remove([path]));
  const hours = [480,480,480,480,480,0,0].map((minutes,index)=>({weekday:index+1,minutes}));
  result(await db.rpc("save_workshop_settings",{p_timezone:"Asia/Tokyo",p_currency:"RUB",p_buffer_minutes:15,p_hours:hours}));
  assert.equal(result(await db.rpc("roomlet_booking_calendar")).timezone,"Asia/Tokyo");
  assert.equal((await catalog()).length,4);
  console.log("PASS showcase: photo, draft, publish, archive, delete, working hours and timezone");
} finally {
  if (server instanceof Worker) await server.terminate();
  else if (server.connected) server.disconnect();
}
