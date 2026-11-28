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
let transferred=false;
let failNextTransfer=false;
const fixtureUser={id:customer,aud:'authenticated',role:'authenticated',email:'',
  app_metadata:{provider:'custom:roomlet-telegram',providers:['custom:roomlet-telegram']},user_metadata:{},
  identities:[{id:'telegram-fixture',identity_id:'telegram-fixture',user_id:customer,provider:'custom:roomlet-telegram',identity_data:{sub:'tg:12345',name:'Test',picture:'https://cdn.example.test/avatar.jpg'}}]};
const ownerUser={id:'bce30769-a1bf-4ba4-b02c-3b1fa2655190',aud:'authenticated',role:'authenticated',email:'owner@example.test',
  email_confirmed_at:new Date().toISOString(),
  app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[]};
const fixtureIssuedAt=Math.floor(Date.now()/1000);
const tokenFor=user=>jsonPart({alg:'HS256'})+'.'+jsonPart({sub:user.id,session_id:'70de250f-793d-4888-9cdd-4218a5207c0f',exp:fixtureIssuedAt+3600,amr:[{method:'password',timestamp:fixtureIssuedAt}]})+'.ZmFrZQ';
const sessionFor=user=>({access_token:tokenFor(user),refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user});
const receipts=new Set(),sent=[];
let emailGateState={};
let verifiedEmail=false;
let disconnectTesting=false,disconnectCount=0,disconnectPrepared=false,staleTelegramMapping=false,unknownTelegram=false,creationPending=false;
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
  if(req.url==='/auth/v1/settings') return json(200,{mailer_autoconfirm:false,external:{email:true}});
  if(req.url==='/auth/v1/user'&&req.method==='PUT') {
    const input=JSON.parse(body);
    if(input.email===ownerUser.email) return json(422,{code:'email_exists',error_code:'email_exists',msg:'Exists'});
    fixtureUser.new_email=input.email;return json(200,fixtureUser);
  }
  if(req.url==='/auth/v1/otp') {assert.equal(JSON.parse(body).create_user,false);return json(200,{});}
  if(req.url==='/auth/v1/verify') {
    const input=JSON.parse(body);
    if(input.token!=='123456') return json(403,{code:'otp_expired',msg:'Invalid'});
    verifiedEmail=true;
    if(input.type==='email') return json(200,sessionFor(ownerUser));
    assert.equal(input.type,'email_change');
    fixtureUser.email=input.email;fixtureUser.email_confirmed_at=new Date().toISOString();
    return json(200,sessionFor(fixtureUser));
  }
  if(req.url==='/auth/v1/user') return json(200,currentUser);
  if(req.url==='/auth/v1/token?grant_type=password') {
    if(disconnectTesting && JSON.parse(body).password!=='fixture-password') return json(400,{code:'invalid_credentials',msg:'Invalid credentials'});
    return json(200,sessionFor(ownerUser));
  }
  if(req.url.startsWith('/auth/v1/user/identities/') && req.method==='DELETE') {
    if(!disconnectPrepared) return json(403,{code:'fresh_auth_required',msg:'Fresh authentication required'});
    const identity=req.url.split('/').at(-1);
    ownerUser.identities=ownerUser.identities.filter(i=>i.identity_id!==identity);
    disconnectCount++;disconnectPrepared=false;return json(200,{});
  }
  if(req.url==='/auth/v1/token?grant_type=refresh_token') return json(200,sessionFor(ownerUser));
  if(req.url.startsWith('/auth/v1/logout')) return json(200,{});
  if(req.url.startsWith('/rest/v1/profiles?')) return json(200,{display_name:'Test',role:currentUser.id===ownerUser.id?'owner':'customer',contact_email:null,contact_phone:null});
  if(req.url==='/rest/v1/rpc/roomlet_telegram_account_merged') return json(200,transferred && JSON.parse(body).p_user_id===customer);
  if(req.url==='/rest/v1/rpc/roomlet_telegram_detached') return json(200,false);
  if(req.url==='/rest/v1/rpc/roomlet_telegram_account') return json(200,staleTelegramMapping||unknownTelegram?null:transferred?ownerUser.id:customer);
  if(req.url==='/rest/v1/rpc/roomlet_claim_telegram_creation'){const created=creationPending;creationPending=false;return json(200,created);}
  if(req.url==='/rest/v1/rpc/roomlet_sync_saved_items')return json(200,{favorites:[],cart:[]});
  if(req.url==='/rest/v1/rpc/roomlet_login_methods') return json(200,{email_ready:JSON.parse(body).p_user===ownerUser.id,telegram_ready:true});
  if(req.url==='/rest/v1/rpc/roomlet_prepare_disconnect') {
    assert.equal(req.headers.apikey,'private-fixture-key');
    const input=JSON.parse(body);
    const validTelegram=input.p_identity==='6e0cbbdb-b46b-4de3-8b03-43191e2715dc' && input.p_retained==='9cb60a87-3841-4771-a449-310305bd437a';
    const validEmail=input.p_identity==='9cb60a87-3841-4771-a449-310305bd437a' && input.p_retained==='6e0cbbdb-b46b-4de3-8b03-43191e2715dc' && stored.has(input.p_proof);
    if(input.p_user!==ownerUser.id || !(validTelegram || validEmail)) return json(403,{code:'42501',message:'Invalid proof'});
    disconnectPrepared=true;return json(200,null);
  }
  if(req.url==='/rest/v1/rpc/roomlet_telegram_link_conflict') {
    const input=JSON.parse(body); assert.equal(req.headers.apikey,'private-fixture-key');
    assert.ok(stored.has(input.p_proof_hash)); return json(200,input.p_telegram_id==='12345' && !transferred);
  }
  if(req.url==='/rest/v1/rpc/roomlet_transfer_telegram') {
    assert.equal(req.headers.apikey,'private-fixture-key');
    const input=JSON.parse(body);
    assert.equal(input.p_target,ownerUser.id);assert.equal(input.p_telegram_id,'12345');
    assert.ok(stored.has(input.p_proof_hash));
    if(failNextTransfer) {failNextTransfer=false;return json(400,{code:'42P01',message:'Fixture dependency unavailable'});}
    transferred=true;return json(200,true);
  }
  if(req.url==='/rest/v1/rpc/roomlet_support_username') return json(200,null);
  if(req.url==='/rest/v1/rpc/roomlet_email_gate') {
    assert.equal(req.headers.apikey,'private-fixture-key');
    const p=JSON.parse(body);
    if(p.p_action==='start') emailGateState={flow_id:p.p_flow,email:p.p_email,kind:'change',phase:'code',expires_at:new Date(Date.now()+600000).toISOString(),retry_at:new Date(Date.now()+60000).toISOString()};
    if(p.p_action==='existing') emailGateState.kind='existing';
    if(['old','merge','finish'].includes(p.p_action)) emailGateState.phase=p.p_action==='finish'?'done':p.p_action;
    return json(200,{...emailGateState,allowed:true});
  }
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
    if(unknownTelegram){unknownTelegram=false;creationPending=true;}
    const {id_token,nonce,provider,link_identity}=JSON.parse(body);
    assert.equal(provider,"custom:roomlet-telegram");
    assert.equal(req.headers.apikey,"public-fixture-key");
    const [head,payload,sig]=id_token.split(".");
    assert.ok(verify("RSA-SHA256",Buffer.from(head+"."+payload),publicKey,Buffer.from(sig,"base64url")));
    const claims=JSON.parse(Buffer.from(payload,"base64url"));
    assert.equal(claims.iss,issuer);assert.equal(claims.aud,"roomlet-mini-app");
    if(link_identity && claims.sub==='tg:12345') return json(422,{code:'identity_already_exists',error_code:'identity_already_exists',msg:'Already linked'});
    assert.equal(claims.sub,link_identity?'tg:67890':'tg:12345');
    assert.equal(claims.nonce,createHash("sha256").update(nonce).digest("hex"));
    if(link_identity) {
      assert.equal(currentUser.id,ownerUser.id);
      return json(200,sessionFor({...ownerUser,identities:[{...fixtureUser.identities[0],user_id:ownerUser.id,identity_data:{sub:'tg:67890'}}]}));
    }
    return json(200,sessionFor(transferred?ownerUser:fixtureUser));
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
    if((browserMode||process.argv.includes('--verify-link-form')) && req.headers.origin===`http://127.0.0.1:${frontend.address().port}` && req.url.startsWith('/api/')) req.headers.origin=issuer;
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
  unknownTelegram=true;
  for(let attempt=0;attempt<2;attempt++) {
    const guest=await post('auto');assert.equal(guest.status,200);assert.deepEqual(await guest.json(),{result:'guest'});
    assert.equal(exchanges,0,'Opening the Mini App must not call native signup');
    assert.equal(stored.size,0,'A new guest does not persist Telegram data or consume the future explicit proof');
  }
  const login=await post("login");
  assert.deepEqual(await login.json(),{result:"created"});
  const sessionCookies=login.headers.getSetCookie();
  assert.ok(sessionCookies.some(value=>value.startsWith('__Host-roomlet-mini=')));
  for(const cookie of sessionCookies.filter(value=>value.startsWith('__Host-roomlet-mini='))) for(const flag of ['secure','httponly','samesite=none','partitioned'])
    assert.ok(cookie.toLowerCase().split(';').map(value=>value.trim()).includes(flag),'Mini App session must persist safely in a cross-site iframe: '+flag);
  const sessionCookie=sessionCookies.map(value=>value.split(';')[0]).join('; ');
  const sessionCheck=await fetch(base+'/api/telegram/session',{headers:{cookie:sessionCookie}});
  assert.deepEqual(await sessionCheck.json(),{authenticated:true},'The browser must confirm that its session cookie was accepted');
  const guestCheck=await fetch(base+'/api/telegram/session');
  assert.deepEqual(await guestCheck.json(),{authenticated:false});
  const repeated=await fetch(base+'/api/telegram/session',{method:'POST',headers:{origin:issuer,'x-roomlet-intent':'login',cookie:sessionCookie},body:fields.toString()});
  assert.deepEqual(await repeated.json(),{result:'existing'});
  assert.equal(exchanges,1,'A preserved session must not create another account');
  const receipt=sessionCookies.find(value=>value.startsWith('__Host-roomlet-launch='))?.split(';')[0];assert.ok(receipt);
  const guestCookie='__Host-roomlet-guest=yes; '+receipt;
  const optedOut=await fetch(base+'/api/telegram/session',{method:'POST',headers:{origin:issuer,'x-roomlet-intent':'auto',cookie:guestCookie},body:fields.toString()});
  assert.deepEqual(await optedOut.json(),{result:'guest'});assert.equal(exchanges,1);
  const explicitAgain=await fetch(base+'/api/telegram/session',{method:'POST',headers:{origin:issuer,'x-roomlet-intent':'login',cookie:guestCookie},body:fields.toString()});
  assert.deepEqual(await explicitAgain.json(),{result:'signed-in'});
  assert.ok(explicitAgain.headers.getSetCookie().some(value=>value.startsWith('__Host-roomlet-guest=;')&&value.includes('Max-Age=0')));
  const replayReceipt=await fetch(base+'/api/telegram/session',{method:'POST',headers:{origin:issuer,'x-roomlet-intent':'login',cookie:guestCookie},body:fields.toString()});
  assert.equal(replayReceipt.status,409,'A consumed browser receipt cannot be replayed');
  const profile=await fetch(base+'/profile/settings',{headers:{cookie:sessionCookie}});
  const profileHTML=await profile.text();
  assert.equal(profile.status,200);
  assert.ok(profileHTML.includes('Личные данные') && !profileHTML.includes('>Покупатель<'),'No email or role label is required for the customer profile');
  const profileHome=await (await fetch(base+'/profile',{headers:{cookie:sessionCookie}})).text();
  assert.ok(profileHome.includes('src="https://cdn.example.test/avatar.jpg"'),'The main profile renders its verified Telegram avatar');
  // Exercise the real rendered email forms and Server Actions, not a separate page.
  const actionForm=html=>{
    const form=new FormData();
    const unescape=v=>v.replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');
    for(const tag of html.matchAll(/<input\b[^>]*>/g)) {
      const name=tag[0].match(/name="([^"]+)"/)?.[1];
      if(name?.startsWith('$ACTION')) form.set(unescape(name),unescape(tag[0].match(/value="([^"]*)"/)?.[1]??''));
    }
    assert.ok([...form.keys()].some(k=>k.startsWith('$ACTION_REF_')));
    return form;
  };
  const emailHTML=await (await fetch(base+'/profile/email',{headers:{cookie:sessionCookie}})).text();
  assert.ok(emailHTML.includes('Подключить почту'));
  const emailForm=actionForm(emailHTML);
  const emailPost=(cookie=sessionCookie)=>fetch(base+'/profile/email',{method:'POST',headers:{origin:base,cookie},body:emailForm,redirect:'manual'});
  emailForm.set('intent','send');emailForm.set('email','new@example.test');
  assert.equal((await emailPost()).status,200);
  assert.equal(fixtureUser.email,'','Sending a code must not confirm the address');
  emailForm.set('intent','verify');emailForm.set('flow',emailGateState.flow_id);emailForm.set('otp','000000');
  await emailPost();assert.equal(verifiedEmail,false);
  emailForm.set('otp','123456');
  const emailVerified=await emailPost();
  assert.ok((await emailVerified.text()).includes('Почта подключена'));
  assert.equal(fixtureUser.id,customer,'Adding email must retain the Telegram UUID');
  assert.equal(fixtureUser.email,'new@example.test');
  fixtureUser.email='';delete fixtureUser.email_confirmed_at;delete fixtureUser.new_email;
  emailGateState={};verifiedEmail=false;
  emailForm.set('intent','send');emailForm.set('email',ownerUser.email);
  await emailPost();assert.equal(emailGateState.kind,'existing');
  emailForm.set('intent','verify');emailForm.set('flow',emailGateState.flow_id);
  const emailConflict=await emailPost();
  const emailConflictHTML=await emailConflict.text();
  assert.ok(emailConflictHTML.includes('Объединить мои аккаунты'));
  assert.equal(transferred,false);
  const emailProof=emailConflict.headers.getSetCookie().find(c=>c.startsWith('__Host-roomlet-email-proof='));
  assert.ok(emailProof && emailProof.toLowerCase().includes('partitioned'));
  emailForm.set('intent','merge');
  const mergeSession=sessionCookie+'; '+emailProof.split(';')[0];
  await emailPost(mergeSession);assert.equal(transferred,false);
  emailForm.set('allow_transfer','yes');
  const emailMerged=await emailPost(mergeSession);
  assert.ok((await emailMerged.text()).includes('Почта подключена'));
  assert.equal(transferred,true,'Email proof and explicit consent transfer to the existing owner UUID');
  transferred=false;emailGateState={};
  console.log('PASS: email OTP rejects wrong code, preserves UUID, does not create duplicate account, and merges only after proof and consent');
  assert.equal((await post("login")).status,409);
  const ownerCookies=[];
  const ownerClient=createServerClient(backendURL,'public-fixture-key',{cookies:{getAll:()=>ownerCookies,setAll:values=>ownerCookies.splice(0,ownerCookies.length,...values)}});
  await ownerClient.auth.signInWithPassword({email:'owner@example.test',password:'local-fixture-only'});
  const ownerCookie=ownerCookies.map(({name,value})=>name+'='+value).join('; ');
  const ownerLaunch=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:67890,first_name:'Owner'})});
  ownerLaunch.set('hash',createHmac('sha256',secret).update([...ownerLaunch].map(([key,v])=>key+'='+v).join('\n')).digest('hex'));
  const ownerPost=(intent,account)=>fetch(base+'/api/telegram/session',{method:'POST',headers:{origin:issuer,'x-roomlet-intent':intent,'x-roomlet-account':account,cookie:ownerCookie},body:ownerLaunch.toString()});
  assert.deepEqual(await (await ownerPost('login',ownerUser.id)).json(),{result:'existing'});
  assert.equal(exchanges,2,'Auto-login must preserve an existing email account without silently linking it');
  assert.equal((await ownerPost('link',customer)).status,401);
  const linked=await ownerPost('link',ownerUser.id);
  assert.deepEqual(await linked.json(),{result:'linked'});
  const linkedCookie=linked.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
  const ownerSettings=await (await fetch(base+'/profile/settings',{headers:{cookie:linkedCookie}})).text();
  assert.ok(ownerSettings.includes(ownerUser.id),'Explicit linking must retain the owner UUID');
  const mergeLaunch=sequence=>{
    const value=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),query_id:sequence,user:JSON.stringify({id:12345,first_name:'Test'})});
    value.set('hash',createHmac('sha256',secret).update([...value].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
    return value.toString();
  };
  const transferPost=consent=>fetch(base+'/api/telegram/session',{method:'POST',headers:{origin:issuer,'x-roomlet-intent':'link',
    'x-roomlet-account':ownerUser.id,'x-roomlet-transfer':consent?'yes':'no',cookie:ownerCookie},body:mergeLaunch(consent?'consented':'not-consented')});
  const pendingMerge=await transferPost(false);
  assert.equal(pendingMerge.status,409);
  assert.deepEqual(await pendingMerge.json(),{result:'merge-required'});
  const mergeCookie=pendingMerge.headers.getSetCookie().find(value=>value.startsWith('__Host-roomlet-telegram-link='));
  assert.ok(mergeCookie && mergeCookie.toLowerCase().includes('httponly') && mergeCookie.toLowerCase().includes('partitioned'));
  const confirmationHTML=await (await fetch(base+'/profile/telegram?confirm=merge',{headers:{cookie:ownerCookie+'; '+mergeCookie.split(';')[0]}})).text();
  assert.ok(confirmationHTML.includes('Объединить мои аккаунты'),'Confirmation appears only after a verified identity conflict');
  assert.equal(transferred,false,'An occupied identity must not transfer without explicit consent');
  const confirmationForm=new FormData();
  const unescape=value=>value.replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');
  for(const input of confirmationHTML.matchAll(/<input\b[^>]*>/g)) {
    const name=input[0].match(/name="([^"]+)"/)?.[1];
    if(name?.startsWith('$ACTION')) confirmationForm.set(unescape(name),unescape(input[0].match(/value="([^"]*)"/)?.[1]??''));
  }
  assert.ok([...confirmationForm.keys()].some(name=>name.startsWith('$ACTION_REF_')),'Use the real rendered server action');
  const confirm=()=>fetch(base+'/profile/telegram?confirm=merge',{method:'POST',redirect:'manual',headers:{origin:base,cookie:ownerCookie+'; '+mergeCookie.split(';')[0]},body:confirmationForm});
  await confirm();
  assert.equal(transferred,false,'Posting the form without its checkbox cannot transfer data');
  if(process.argv.includes('--verify-link-form')) {
    const {chromium,expect}=await import('@playwright/test');
    const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{})});
    try {
      const page=await browser.newPage({viewport:{width:390,height:844},extraHTTPHeaders:{cookie:ownerCookie+'; '+mergeCookie.split(';')[0]}});
      await page.goto(base+'/profile/telegram?confirm=merge');
      const consent=page.getByRole('checkbox',{name:/Объединить мои аккаунты/});
      const button=page.getByRole('button',{name:'Объединить и подключить'});
      await expect(consent).not.toBeChecked();await expect(button).toBeDisabled();
      await consent.check();await expect(button).toBeEnabled();
      failNextTransfer=true;
      await button.click();
      await expect(page.getByRole('alert').filter({hasText:'Не удалось объединить аккаунты'})).toBeVisible();
      await expect(consent).not.toBeChecked();await expect(button).toBeDisabled();
      assert.equal(transferred,false);
      await consent.check();await expect(button).toBeEnabled();
      await consent.uncheck();await expect(button).toBeDisabled();
      console.log('PASS: real confirmation form disables submission before consent and after failed-action reset');
    } finally {failNextTransfer=false;await browser.close();}
  }
  confirmationForm.set('allow_transfer','yes');
  const merged=await confirm();
  if(merged.status!==303) {
    const html=await merged.text();
    console.log('Confirmation response:',{status:merged.status,expired:html.includes('Время подтверждения истекло'),missingConsent:html.includes('Подтвердите объединение аккаунтов.'),transferError:html.includes('Не удалось объединить аккаунты.'),actionFields:[...confirmationForm.keys()]});
  }
  assert.equal(merged.status,303);
  assert.ok(merged.headers.get('location').includes('telegram=linked'));
  assert.equal(transferred,true);
  const afterTransfer=await fetch(base+'/api/telegram/session',{method:'POST',headers:{origin:issuer,'x-roomlet-intent':'login',cookie:sessionCookie},body:mergeLaunch('reopen-after-transfer')});
  assert.deepEqual(await afterTransfer.json(),{result:'signed-in'},'An old customer cookie must be replaced after an explicitly confirmed transfer');
  staleTelegramMapping=true;
  const racedLogin=await fetch(base+'/api/telegram/session',{method:'POST',headers:{origin:issuer,'x-roomlet-intent':'login'},body:mergeLaunch('login-raced-with-unlink')});
  assert.equal(racedLogin.status,409);assert.deepEqual(await racedLogin.json(),{result:'detached'});
  staleTelegramMapping=false;
  const transferredCookies=afterTransfer.headers.getSetCookie().filter(value=>value.startsWith('__Host-roomlet-mini=') && !value.startsWith('__Host-roomlet-mini=;')).map(value=>value.split(';')[0]).join('; ');
  const transferredProfile=await (await fetch(base+'/profile/settings',{headers:{cookie:transferredCookies}})).text();
  assert.ok(transferredProfile.includes(ownerUser.id),'Telegram signs into the original owner UUID after transfer');
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
  if(process.argv.includes('--verify-link-form')) {
    disconnectTesting=true;
    ownerUser.identities=[
      {id:ownerUser.id,identity_id:'9cb60a87-3841-4771-a449-310305bd437a',user_id:ownerUser.id,provider:'email',identity_data:{sub:ownerUser.id,email:ownerUser.email}},
      {id:'tg:12345',identity_id:'6e0cbbdb-b46b-4de3-8b03-43191e2715dc',user_id:ownerUser.id,provider:'custom:roomlet-telegram',identity_data:{sub:'tg:12345'}},
    ];
    const {chromium,expect}=await import('@playwright/test');
    const {mkdir}=await import('node:fs/promises');
    await mkdir('.roomlet-demo/verify-disconnect',{recursive:true});
    const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{})});
    try {
      const page=await browser.newPage({viewport:{width:390,height:844},extraHTTPHeaders:{cookie:ownerCookie}});
      await page.goto(base+'/profile/settings');
      await page.getByRole('button',{name:'Отключить Telegram',exact:true}).click();
      const dialog=page.getByRole('dialog');
      const consent=dialog.getByRole('checkbox',{name:'Подтверждаю отключение'});
      const submit=dialog.getByRole('button',{name:'Отключить',exact:true});
      await expect(submit).toBeDisabled();
      for(const width of [320,360,390,430,768,1440]) {
        await page.setViewportSize({width,height:844});
        assert.ok(await dialog.evaluate(el=>el.getBoundingClientRect().left>=0&&el.getBoundingClientRect().right<=innerWidth));
        assert.ok(await dialog.evaluate(el=>Math.abs(el.getBoundingClientRect().left+el.getBoundingClientRect().width/2-innerWidth/2)<2),'Dialog must be centered');
        await page.screenshot({path:'.roomlet-demo/verify-disconnect/modal-'+width+'.png',animations:'disabled'});
      }
      await page.setViewportSize({width:390,height:844});
      await consent.check();await expect(submit).toBeDisabled();
      await dialog.getByLabel('Пароль',{exact:true}).fill('wrong-password');
      await expect(submit).toBeEnabled();await submit.click();
      await expect(dialog.getByRole('alert')).toContainText('Не удалось подтвердить пароль');
      assert.equal(disconnectCount,0);
      await expect(consent).not.toBeChecked();await expect(submit).toBeDisabled();
      // Use the actual Server Action form after an error. Missing consent still
      // fails server-side even if a caller bypasses the disabled HTML button.
      const html=await dialog.locator('form').evaluate(form=>form.outerHTML);
      const form=actionForm(html);form.set('method','telegram');form.set('password','fixture-password');
      const post=()=>fetch(base+'/profile/settings',{method:'POST',headers:{origin:base,cookie:ownerCookie},body:form,redirect:'manual'});
      await post();assert.equal(disconnectCount,0);
      form.set('confirm','yes');
      const removed=await post();assert.equal(removed.status,303);
      assert.ok(removed.headers.get('location').includes('disconnected=telegram'));
      assert.equal(disconnectCount,1);assert.equal(ownerUser.identities.length,1);
      ownerUser.identities.push({id:'tg:12345',identity_id:'6e0cbbdb-b46b-4de3-8b03-43191e2715dc',user_id:ownerUser.id,provider:'custom:roomlet-telegram',identity_data:{sub:'tg:12345'}});
      form.set('method','email');form.set('initData',mergeLaunch('detach-email-mini'));
      const emailRemoved=await post();assert.equal(emailRemoved.status,303);
      assert.ok(emailRemoved.headers.get('location').includes('/profile/settings?disconnected=email'));
      assert.ok(emailRemoved.headers.getSetCookie().some(value=>value.startsWith('__Host-roomlet-mini=base64-')),'Mini App gets a fresh remaining-method session');
      assert.equal(disconnectCount,2);assert.equal(ownerUser.identities.length,1);
      assert.equal(ownerUser.identities[0].provider,'custom:roomlet-telegram');
      console.log('PASS: actual settings modal at six widths, disabled/consent/password/error states, native unlink via Server Action');
    } finally {await browser.close();disconnectTesting=false;}
  }
  if(process.argv.includes('--verify-link-form')) {
    const {chromium,expect}=await import('@playwright/test');
    const {mkdir}=await import('node:fs/promises');
    await mkdir('.roomlet-demo/verify-guest',{recursive:true});
    const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{})});
    try {
      transferred=false;unknownTelegram=true;
      const before=exchanges,context=await browser.newContext({viewport:{width:390,height:844}});
      const raw=mergeLaunch('guest-browser-explicit');
      await context.route('https://telegram.org/js/telegram-web-app.js',route=>route.fulfill({contentType:'text/javascript',body:`window.Telegram={WebApp:{initData:${JSON.stringify(raw)},ready(){}}};`}));
      const page=await context.newPage();
      await page.goto(base+'/profile');
      const button=page.getByRole('button',{name:'Продолжить через Telegram',exact:true});
      await expect(button).toBeEnabled();assert.equal(exchanges,before,'Opening the real profile must not create an account');
      await expect(page.locator('input[type=email]')).toHaveCount(0);
      await expect(page.locator('a[href^="/api/telegram/login"]')).toHaveCount(0);
      for(const width of [320,360,390,430,768,1440]){
        await page.setViewportSize({width,height:844});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.screenshot({path:'.roomlet-demo/verify-guest/profile-'+width+'.png',fullPage:true,animations:'disabled'});
      }
      await page.setViewportSize({width:390,height:844});
      await button.click();
      await expect(page.getByRole('button',{name:'Выйти из аккаунта'})).toBeVisible();
      assert.equal(exchanges,before+1,'One explicit click creates one customer session');
      await page.screenshot({path:'.roomlet-demo/verify-guest/registered-390.png',fullPage:true,animations:'disabled'});
      await page.reload();await expect(page.getByRole('button',{name:'Выйти из аккаунта'})).toBeVisible();
      assert.equal(exchanges,before+1,'Reopening an authenticated profile reuses its session');
      console.log('PASS: actual profile at six widths, guest has no email/OIDC forms, explicit Telegram button and preserved session');
    } finally {unknownTelegram=false;await browser.close();}
  }
  console.log("PASS: discovery, JWKS, same-origin, signature, link guard, native ID-token exchange, SSR cookie and replay");
  console.log('PASS: webhook secret, duplicate command, catalog button, OIDC PKCE redirect, secure cookie and callback guard');
} catch(error) {
  console.error('Telegram integration test failed:',error.message);
  process.exitCode=1;
} finally {
  for(const server of [frontend,backend]) if(server?.listening){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  await app.close();
}
