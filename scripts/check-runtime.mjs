// Run in the deployed SSR environment. Log statuses only, never headers, tokens or response bodies.
import { createPrivateKey } from "node:crypto";

const [major,minor] = process.versions.node.split(".").map(Number);
let failed = false;
function report(label,ok) {
  console.log(label,ok?"OK":"FAIL");
  if (!ok) failed = true;
}
console.log("Node",process.versions.node);
report("Node >=22.13",major>22 || major===22 && minor>=13);
const {NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key,ROOMLET_SITE_URL:site}=process.env;
const validOrigin = value => {
  try { const parsed = new URL(value); return parsed.protocol==="https:" && parsed.origin===value; }
  catch { return false; }
};
report("Supabase HTTPS origin",validOrigin(url));
report("Publishable key",Boolean(key?.startsWith("sb_publishable_")));
report("Site HTTPS origin",validOrigin(site));
report("Demo disabled on hosted preview",process.env.ROOMLET_DEMO_MODE!=="true");
if (validOrigin(url) && key?.startsWith("sb_publishable_")) {
  for (const [label,path,method] of [["Auth","/auth/v1/settings","GET"],["Catalog RPC","/rest/v1/rpc/roomlet_catalog?select=id&limit=1","POST"]]) {
    try {
      const res=await fetch(url+path,{method,redirect:"error",signal:AbortSignal.timeout(8000),headers:{apikey:key,"content-type":"application/json"},body:method==="POST"?"{}":undefined});
      const data=await res.json();
      report(label+" HTTP "+res.status,res.ok && (method==="GET"?typeof data.external==="object":Array.isArray(data)));
    } catch { report(label,false); }
  }
}
if (process.env.ROOMLET_TELEGRAM_ENABLED==="true") {
  report("Bot token present",Boolean(process.env.ROOMLET_TELEGRAM_BOT_TOKEN));
  report("Supabase server key present",Boolean(process.env.SUPABASE_SECRET_KEY));
  try {
    const privateKey=createPrivateKey(Buffer.from(process.env.ROOMLET_TELEGRAM_SIGNING_KEY??"","base64"));
    report("RSA signing key",privateKey.asymmetricKeyType==="rsa" && privateKey.asymmetricKeyDetails.modulusLength>=2048);
  } catch { report("RSA signing key",false); }
}
if (failed) process.exitCode=1;
