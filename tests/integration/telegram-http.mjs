// Production Next routes and real Supabase SDK against a loopback Auth HTTP fixture.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createHmac, createHash, generateKeyPairSync, verify } from "node:crypto";
import next from "next";

const {publicKey,privateKey} = generateKeyPairSync("rsa",{modulusLength:2048});
const botToken="fixture-bot-token", issuer="https://mini.example", customer="37d39ed5-04b4-48fa-a8bb-6db339ce4e1b";
const stored = new Set();
const jsonPart = data => Buffer.from(JSON.stringify(data)).toString("base64url");
async function listen(server) {
  server.listen(0,"127.0.0.1"); await once(server,"listening"); return "http://127.0.0.1:"+server.address().port;
}
const backend=createServer(async(req,res)=>{
  const json=(status,data)=>{res.writeHead(status,{"content-type":"application/json"});res.end(JSON.stringify(data));};
  let body="";for await (const part of req) body+=part;
  if (req.url === "/rest/v1/rpc/consume_telegram_launch") {
    assert.equal(req.headers.apikey,"private-fixture-key");
    const {proof_hash}=JSON.parse(body);
    const unused=!stored.has(proof_hash);stored.add(proof_hash);
    return json(200,unused);
  }
  if (req.url === "/auth/v1/token?grant_type=id_token") {
    const {id_token,nonce,provider}=JSON.parse(body);
    assert.equal(provider,"custom:roomlet-telegram");
    assert.equal(req.headers.apikey,"public-fixture-key");
    const [head,payload,sig]=id_token.split(".");
    assert.ok(verify("RSA-SHA256",Buffer.from(head+"."+payload),publicKey,Buffer.from(sig,"base64url")));
    const claims=JSON.parse(Buffer.from(payload,"base64url"));
    assert.equal(claims.iss,issuer);assert.equal(claims.aud,"roomlet-mini-app");assert.equal(claims.sub,"tg:12345");
    assert.equal(claims.nonce,createHash("sha256").update(nonce).digest("hex"));
    const token=jsonPart({alg:"HS256"})+"."+jsonPart({sub:customer,exp:Math.floor(Date.now()/1000)+3600})+".ZmFrZQ";
    return json(200,{access_token:token,refresh_token:"fixture-refresh",token_type:"bearer",expires_in:3600,user:{id:customer,aud:"authenticated",role:"authenticated",identities:[]}});
  }
  json(404,{message:"unexpected fixture route"});
});
const backendURL=await listen(backend);
Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:backendURL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"public-fixture-key",
  SUPABASE_SECRET_KEY:"private-fixture-key",ROOMLET_SITE_URL:issuer,ROOMLET_TELEGRAM_ENABLED:"true",ROOMLET_TELEGRAM_BOT_TOKEN:botToken,
  ROOMLET_TELEGRAM_SIGNING_KEY:Buffer.from(privateKey.export({format:"pem",type:"pkcs8"})).toString("base64"),NODE_ENV:"production"});
const app=next({dev:false});
let frontend;
try {
  await app.prepare();
  frontend=createServer(app.getRequestHandler());
  const base=await listen(frontend);
  const discovery=await (await fetch(base+"/.well-known/openid-configuration")).json();
  assert.equal(discovery.issuer,issuer);
  const jwks=await (await fetch(base+"/api/telegram/jwks")).json();
  assert.equal(jwks.keys[0].n, publicKey.export({format:"jwk"}).n);assert.equal(jwks.keys[0].d,undefined);
  const fields=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:12345,first_name:"Test"})});
  const secret=createHmac("sha256","WebAppData").update(botToken).digest();
  fields.set("hash",createHmac("sha256",secret).update([...fields].map(([key,v])=>key+"="+v).join("\n")).digest("hex"));
  const post=(intent,origin=issuer,body=fields.toString())=>fetch(base+"/api/telegram/session",{method:"POST",headers:{origin,"x-roomlet-intent":intent},body});
  assert.equal((await post("login","https://other.example")).status,403);
  assert.equal((await post("login",issuer,"invalid")).status,401);
  assert.equal((await post("link")).status,401);
  assert.equal(stored.size,0);
  const login=await post("login");
  assert.deepEqual(await login.json(),{result:"signed-in"});
  assert.match(login.headers.get("set-cookie")??"",/auth-token/);
  assert.equal((await post("login")).status,409);
  console.log("PASS: discovery, JWKS, same-origin, signature, link guard, native ID-token exchange, SSR cookie and replay");
} finally {
  for(const server of [frontend,backend]) if(server?.listening){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  await app.close();
}
