// Production Next routes and real Supabase SDK against a loopback Auth HTTP fixture.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createHmac, createHash, generateKeyPairSync, verify } from "node:crypto";
import next from "next";
import {createServerClient} from '@supabase/ssr';

const {publicKey,privateKey} = generateKeyPairSync("rsa",{modulusLength:2048});
const botToken="fixture-bot-token", issuer="https://mini.example", customer="37d39ed5-04b4-48fa-a8bb-6db339ce4e1b";
const stored = new Set();
let exchanges=0;
const fixtureUser={id:customer,aud:'authenticated',role:'authenticated',email:'',
  app_metadata:{provider:'custom:roomlet-telegram',providers:['custom:roomlet-telegram']},user_metadata:{},
  identities:[{id:'telegram-fixture',identity_id:'telegram-fixture',user_id:customer,provider:'custom:roomlet-telegram',identity_data:{sub:'tg:12345',name:'Test'}}]};
const ownerUser={id:'bce30769-a1bf-4ba4-b02c-3b1fa2655190',aud:'authenticated',role:'authenticated',email:'owner@example.test',
  app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[]};
const fixtureIssuedAt=Math.floor(Date.now()/1000);
const tokenFor=user=>jsonPart({alg:'HS256'})+'.'+jsonPart({sub:user.id,exp:fixtureIssuedAt+3600,amr:[{method:'password',timestamp:fixtureIssuedAt}]})+'.ZmFrZQ';
const sessionFor=user=>({access_token:tokenFor(user),refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user});
const receipts=new Set(),sent=[];
const realFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
  if(String(input).startsWith('https://api.telegram.org/')) {
    sent.push(JSON.parse(options.body));
    return Response.json({ok:true,result:{message_id:1}});
  }
  return realFetch(input,options);
};
const jsonPart = data => Buffer.from(JSON.stringify(data)).toString("base64url");
async function listen(server) {
  server.listen(0,"127.0.0.1"); await once(server,"listening"); return "http://127.0.0.1:"+server.address().port;
}
const backend=createServer(async(req,res)=>{
  const json=(status,data)=>{res.writeHead(status,{"content-type":"application/json"});res.end(JSON.stringify(data));};
  let body="";for await (const part of req) body+=part;
  const currentUser=req.headers.authorization==='Bearer '+tokenFor(ownerUser)?ownerUser:fixtureUser;
  if(req.url==='/auth/v1/user') return json(200,currentUser);
  if(req.url==='/auth/v1/token?grant_type=password') return json(200,sessionFor(ownerUser));
  if(req.url.startsWith('/rest/v1/profiles?')) return json(200,{display_name:'Test',role:currentUser.id===ownerUser.id?'owner':'customer'});
  if(req.url==='/rest/v1/rpc/roomlet_support_username') return json(200,null);
  if(req.url.startsWith('/rest/v1/') && !['consume_telegram_launch','claim_telegram_update','finish_telegram_update'].some(name=>req.url==='/rest/v1/rpc/'+name)) return json(200,[]);
  if(req.url==='/rest/v1/rpc/claim_telegram_update') {
    const {event_id}=JSON.parse(body);
    const unused=!receipts.has(event_id);receipts.add(event_id);
    return json(200,unused);
  }
  if(req.url==='/rest/v1/rpc/finish_telegram_update') return json(200,null);
  if (req.url === "/rest/v1/rpc/consume_telegram_launch") {
    assert.equal(req.headers.apikey,"private-fixture-key");
    const {proof_hash}=JSON.parse(body);
    const unused=!stored.has(proof_hash);stored.add(proof_hash);
    return json(200,unused);
  }
  if (req.url === "/auth/v1/token?grant_type=id_token") {
    exchanges++;
    const {id_token,nonce,provider,link_identity}=JSON.parse(body);
    assert.equal(provider,"custom:roomlet-telegram");
    assert.equal(req.headers.apikey,"public-fixture-key");
    const [head,payload,sig]=id_token.split(".");
    assert.ok(verify("RSA-SHA256",Buffer.from(head+"."+payload),publicKey,Buffer.from(sig,"base64url")));
    const claims=JSON.parse(Buffer.from(payload,"base64url"));
    assert.equal(claims.iss,issuer);assert.equal(claims.aud,"roomlet-mini-app");assert.equal(claims.sub,link_identity?'tg:67890':'tg:12345');
    assert.equal(claims.nonce,createHash("sha256").update(nonce).digest("hex"));
    if(link_identity) {
      assert.equal(currentUser.id,ownerUser.id);
      return json(200,sessionFor({...ownerUser,identities:[{...fixtureUser.identities[0],user_id:ownerUser.id,identity_data:{sub:'tg:67890'}}]}));
    }
    return json(200,sessionFor(fixtureUser));
  }
  json(404,{message:"unexpected fixture route"});
});
const backendURL=await listen(backend);
Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:backendURL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"public-fixture-key",
  SUPABASE_SECRET_KEY:"private-fixture-key",ROOMLET_SITE_URL:issuer,ROOMLET_TELEGRAM_ENABLED:"true",TELEGRAM_BOT_TOKEN:botToken,
  ROOMLET_TELEGRAM_SIGNING_KEY:Buffer.from(privateKey.export({format:"pem",type:"pkcs8"})).toString("base64"),NODE_ENV:"production"});
Object.assign(process.env,{TELEGRAM_WEBHOOK_SECRET:'fixture-webhook-secret-1234567890123456',TELEGRAM_OIDC_CLIENT_ID:'9290085948',TELEGRAM_OIDC_CLIENT_SECRET:'fixture-client-secret'});
const app=next({dev:false});
let frontend;
try {
  await app.prepare();
  const handler=app.getRequestHandler();
  const browserMode=process.env.ROOMLET_TELEGRAM_BROWSER==='1';
  let launches=0;
  frontend=createServer((req,res)=>{
    if(browserMode && req.url.startsWith('/__telegram-browser')) {
      const fields=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),query_id:'browser-'+(++launches),user:JSON.stringify({id:12345,first_name:'Test'})});
      const secret=createHmac('sha256','WebAppData').update(botToken).digest();
      fields.set('hash',createHmac('sha256',secret).update([...fields].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
      const mode=new URL(req.url,'http://localhost').searchParams.get('mode');
      const path=mode==='root'?'/':mode==='link'?'/profile/telegram':mode==='register'?'/profile/register':'/profile/login';
      const fragment=new URLSearchParams({tgWebAppData:mode==='invalid'?'invalid':fields.toString(),tgWebAppVersion:'9.0',tgWebAppPlatform:'web'});
      const source=mode==='before'?'https://lilleo-create-roomlet-ec4d.twc1.net/api/telegram/login':`http://127.0.0.1:${frontend.address().port}${path}#${fragment}`;
      res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
      return res.end(`<h1>Изолированная проверка Telegram Web</h1><p>Тестовая подпись и локальная Auth API. Рабочая база не используется.</p><nav><a href="?mode=login">Mini App: вход</a> | <a href="?mode=root">Главная</a> | <a href="?mode=register">Регистрация</a> | <a href="?mode=invalid">Неверная подпись</a> | <a href="?mode=before">Серый экран до исправления</a></nav><iframe title="Roomlet Mini App" src="${source}" style="width:390px;height:760px;border:1px solid #ddd"></iframe>`);
    }
    // Only the loopback browser fixture translates the local HTTP origin to its HTTPS test issuer.
    if(browserMode && req.headers.origin===`http://127.0.0.1:${frontend.address().port}`) req.headers.origin=issuer;
    return handler(req,res);
  });
  const base=await listen(frontend);
  if(browserMode) {
    console.log('Browser fixture: '+base.replace('127.0.0.1','localhost')+'/__telegram-browser');
    await new Promise(()=>{});
  }
  const framedLogin=await fetch(base+'/api/telegram/login?next=/catalog',{headers:{'sec-fetch-dest':'iframe'},redirect:'manual'});
  assert.equal(new URL(framedLogin.headers.get('location')).pathname,'/mini','An iframe must never navigate to the frame-blocked OIDC screen');
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
  const sessionCookies=login.headers.getSetCookie();
  assert.ok(sessionCookies.some(value=>value.startsWith('__Host-roomlet-mini=')));
  for(const cookie of sessionCookies) for(const flag of ['secure','httponly','samesite=none','partitioned'])
    assert.ok(cookie.toLowerCase().split(';').map(value=>value.trim()).includes(flag),'Mini App session must persist safely in a cross-site iframe: '+flag);
  const sessionCookie=sessionCookies.map(value=>value.split(';')[0]).join('; ');
  const sessionCheck=await fetch(base+'/api/telegram/session',{headers:{cookie:sessionCookie}});
  assert.deepEqual(await sessionCheck.json(),{authenticated:true},'The browser must confirm that its session cookie was accepted');
  const guestCheck=await fetch(base+'/api/telegram/session');
  assert.deepEqual(await guestCheck.json(),{authenticated:false});
  const repeated=await fetch(base+'/api/telegram/session',{method:'POST',headers:{origin:issuer,'x-roomlet-intent':'login',cookie:sessionCookie},body:fields.toString()});
  assert.deepEqual(await repeated.json(),{result:'existing'});
  assert.equal(exchanges,1,'A preserved session must not create another account');
  const profile=await fetch(base+'/profile/settings',{headers:{cookie:sessionCookie}});
  const profileHTML=await profile.text();
  assert.equal(profile.status,200);
  assert.ok(profileHTML.includes('Покупатель') && profileHTML.includes('Не указана'),'No email is required for the customer profile');
  assert.equal((await post("login")).status,409);
  const ownerCookies=[];
  const ownerClient=createServerClient(backendURL,'public-fixture-key',{cookies:{getAll:()=>ownerCookies,setAll:values=>ownerCookies.splice(0,ownerCookies.length,...values)}});
  await ownerClient.auth.signInWithPassword({email:'owner@example.test',password:'local-fixture-only'});
  const ownerCookie=ownerCookies.map(({name,value})=>name+'='+value).join('; ');
  const ownerLaunch=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:67890,first_name:'Owner'})});
  ownerLaunch.set('hash',createHmac('sha256',secret).update([...ownerLaunch].map(([key,v])=>key+'='+v).join('\n')).digest('hex'));
  const ownerPost=(intent,account)=>fetch(base+'/api/telegram/session',{method:'POST',headers:{origin:issuer,'x-roomlet-intent':intent,'x-roomlet-account':account,cookie:ownerCookie},body:ownerLaunch.toString()});
  assert.deepEqual(await (await ownerPost('login',ownerUser.id)).json(),{result:'existing'});
  assert.equal(exchanges,1,'Auto-login must preserve an existing email account without silently linking it');
  assert.equal((await ownerPost('link',customer)).status,401);
  const linked=await ownerPost('link',ownerUser.id);
  assert.deepEqual(await linked.json(),{result:'linked'});
  const linkedCookie=linked.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
  const ownerSettings=await (await fetch(base+'/profile/settings',{headers:{cookie:linkedCookie}})).text();
  assert.ok(ownerSettings.includes('Владелец мастерской'),'Explicit linking must retain the owner account');
  const update={update_id:7,message:{chat:{id:12345,type:'private'},from:{id:12345,is_bot:false},text:'/shop'}};
  const webhook=secret=>fetch(base+'/api/telegram/webhook',{method:'POST',headers:{'x-telegram-bot-api-secret-token':secret},body:JSON.stringify(update)});
  assert.equal((await webhook('wrong')).status,403);
  assert.equal(sent.length,0);
  assert.equal((await webhook(process.env.TELEGRAM_WEBHOOK_SECRET)).status,200);
  assert.equal((await webhook(process.env.TELEGRAM_WEBHOOK_SECRET)).status,200);
  assert.equal(sent.length,1);
  assert.equal(sent[0].chat_id,12345);
  assert.equal(new URL(sent[0].reply_markup.inline_keyboard[0][0].web_app.url).searchParams.get('next'),'/catalog');
  const web=await fetch(base+'/api/telegram/login?next=/catalog',{redirect:'manual'});
  assert.equal(web.status,303);
  assert.equal(new URL(web.headers.get('location')).origin,'https://oauth.telegram.org');
  const attributes=web.headers.get('set-cookie').split(';').slice(1).map(value=>value.trim().toLowerCase());
  assert.ok(web.headers.get('set-cookie').startsWith('__Host-roomlet-telegram-flow='));
  for(const flag of ['secure','httponly','samesite=lax','path=/']) assert.ok(attributes.includes(flag));
  assert.equal((await fetch(base+'/api/telegram/login',{method:'POST',headers:{origin:'https://evil.example'},redirect:'manual'})).status,403);
  const invalidCallback=await fetch(base+'/api/telegram/login/callback?code=invalid&state=invalid',{redirect:'manual'});
  assert.equal(new URL(invalidCallback.headers.get('location')).pathname,'/profile/login');
  console.log("PASS: discovery, JWKS, same-origin, signature, link guard, native ID-token exchange, SSR cookie and replay");
  console.log('PASS: webhook secret, duplicate command, catalog button, OIDC PKCE redirect, secure cookie and callback guard');
} catch(error) {
  console.error('Telegram integration test failed:',error.message);
  process.exitCode=1;
} finally {
  for(const server of [frontend,backend]) if(server?.listening){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  await app.close();
}
