// Run only in the deployed container. Disposable synthetic customer; no owner,
// email delivery, secret or real Telegram profile is modified or logged.
import assert from 'node:assert/strict';
import {randomInt,randomUUID,createHmac} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
if(!process.argv.includes('--confirm-test-accounts'))throw Error('Disposable test account flag required');
const origin=process.env.ROOMLET_SITE_URL;
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const id=String(8000000000000+randomInt(1,1000000000)),jar=new Map();
function launch(){const data=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),query_id:randomUUID(),user:JSON.stringify({id:Number(id),first_name:'Guest flow verification'})});const secret=createHmac('sha256','WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();data.set('hash',createHmac('sha256',secret).update([...data].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n')).digest('hex'));return data.toString();}
async function request(path,init={}){const response=await fetch(origin+path,{...init,redirect:'manual',headers:{origin,cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...init.headers}});for(const cookie of response.headers.getSetCookie()){const first=cookie.split(';')[0],split=first.indexOf('=');if(/max-age=0(?:;|$)/i.test(cookie))jar.delete(first.slice(0,split));else jar.set(first.slice(0,split),first.slice(split+1));}return response;}
const login=(intent,body)=>request('/api/telegram/session',{method:'POST',headers:{'x-roomlet-intent':intent},body});
async function mapped(){const result=await admin.rpc('roomlet_telegram_account',{p_telegram_id:id});if(result.error)throw Error('lookup');return result.data;}
let userId,stage='guest';
try {
  assert.equal(await mapped(),null);
  let body=launch();
  for(let i=0;i<2;i++){const result=await login('auto',body);assert.equal(result.status,200);assert.deepEqual(await result.json(),{result:'guest'});assert.equal(await mapped(),null);}
  stage='explicit-registration';const signed=await login('login',body);assert.equal(signed.status,200);assert.deepEqual(await signed.json(),{result:'created'});
  userId=await mapped();assert.ok(userId);
  const user=(await admin.auth.admin.getUserById(userId)).data.user;assert.ok(!user.email);assert.equal(user.identities.length,1);
  const profile=await request('/profile');assert.equal(profile.status,200);assert.ok(!(await profile.text()).includes('profile-studio'));
  const check=await request('/api/telegram/session');assert.deepEqual(await check.json(),{authenticated:true});
  stage='saved-items';const op={id:randomUUID(),kind:'favorite',key:'night-library',value:'night-library'};
  for(let i=0;i<2;i++){const response=await request('/api/profile/saved',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId:userId,operations:[op]})});assert.equal(response.status,200);assert.deepEqual((await response.json()).state.favorites,['night-library']);}
  assert.equal((await request('/api/profile/saved',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId:randomUUID(),operations:[op]})})).status,409);
  stage='logout';const html=await (await request('/profile')).text();const formHtml=html.match(/<form[^>]*class="profile-signout-form"[\s\S]*?<\/form>/)?.[0];assert.ok(formHtml);
  const action=formHtml.match(/name="(\$ACTION_ID_[^"]+)"/);assert.ok(action);const form=new FormData();form.set(action[1],'');
  const logout=await request('/profile',{method:'POST',body:form});assert.equal(logout.status,303);assert.equal(jar.get('__Host-roomlet-guest'),'yes');
  stage='guest-after-logout';body=launch();assert.deepEqual(await (await login('auto',body)).json(),{result:'guest'});
  assert.deepEqual(await (await request('/api/telegram/session')).json(),{authenticated:false});
  stage='explicit-relogin';assert.deepEqual(await (await login('login',body)).json(),{result:'signed-in'});assert.equal(await mapped(),userId);
  stage='automatic-existing';jar.clear();assert.deepEqual(await (await login('auto',launch())).json(),{result:'signed-in'});assert.equal(await mapped(),userId);
  assert.equal((await request('/studio')).status,307);
  console.log(JSON.stringify({guestWithoutAccount:true,explicitCustomer:true,sameUuid:true,logoutPersists:true,explicitRelogin:true,existingAutoLogin:true,savedItemsIdempotent:true,crossAccountWriteRejected:true,customerStudioDenied:true}));
} catch(error){console.log(JSON.stringify({passed:false,stage,code:typeof error.code==='string'?error.code:'assertion'}));process.exitCode=1;}
finally{userId??=await mapped();if(userId){const result=await admin.auth.admin.deleteUser(userId);console.log(JSON.stringify({testAccountRemoved:!result.error}));if(result.error)process.exitCode=1;}}
