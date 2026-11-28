// Opt-in characterization of the deployed Supabase Auth, using a disposable
// customer only. No real Telegram IDs, owner changes, mail or credentials logged.
import assert from 'node:assert/strict';
import {createHash,createPrivateKey,createPublicKey,randomBytes,randomInt,sign} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
if(!process.argv.includes('--confirm-test-accounts')) throw Error('Explicit disposable-account test flag required');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(url,process.env.SUPABASE_SECRET_KEY,options);
const fresh=()=>createClient(url,key,options);
const email='roomlet-unlink-'+randomBytes(10).toString('hex')+'@example.test';
const password=randomBytes(32).toString('base64url');
const tg=String(9000000000000000+randomInt(1,1000000));
const provider='custom:roomlet-telegram';
const privateKey=createPrivateKey(Buffer.from(process.env.ROOMLET_TELEGRAM_SIGNING_KEY,'base64'));
const pub=createPublicKey(privateKey);
const kid=createHash('sha256').update(pub.export({type:'spki',format:'der'})).digest('base64url');
function credential() {
  const nonce=randomBytes(32).toString('base64url'),now=Math.floor(Date.now()/1000);
  const head=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid})).toString('base64url');
  const body=Buffer.from(JSON.stringify({iss:process.env.ROOMLET_SITE_URL,aud:'roomlet-mini-app',sub:'tg:'+tg,
    iat:now,exp:now+60,nonce:createHash('sha256').update(nonce).digest('hex')})).toString('base64url');
  const input=head+'.'+body;
  return {provider,nonce,token:input+'.'+sign('RSA-SHA256',Buffer.from(input),privateKey).toString('base64url')};
}
const checked=result=>{if(result.error) throw Object.assign(Error('Auth test failed'),{code:result.error.code});return result.data;};
let id;let stage='create-disposable-customer';
try {
  id=checked(await admin.auth.admin.createUser({email,password,email_confirm:true})).user.id;
  const client=fresh();checked(await client.auth.signInWithPassword({email,password}));
  stage='link-native-telegram';checked(await client.auth.linkIdentity(credential()));
  const user=checked(await client.auth.getUser()).user;
  assert.equal(user.id,id);assert.equal(user.identities.length,2);
  const tgIdentity=user.identities.find(i=>i.provider===provider),emailIdentity=user.identities.find(i=>i.provider==='email');
  stage='reject-direct-unlink';assert.ok((await client.auth.unlinkIdentity(tgIdentity)).error);
  async function prepare(c,removed,retained,proof=null) {
    const claims=checked(await c.auth.getClaims()).claims;
    checked(await admin.rpc('roomlet_prepare_disconnect',{p_user:id,p_identity:removed.identity_id,p_retained:retained.identity_id,p_session:claims.session_id,p_proof:proof}));
  }
  stage='disconnect-telegram';await prepare(client,tgIdentity,emailIdentity);checked(await client.auth.unlinkIdentity(tgIdentity));
  assert.ok((await client.auth.getUser()).error,'Old Auth session must be rejected');
  const detached=checked(await admin.rpc('roomlet_telegram_detached',{p_telegram_id:tg}));assert.equal(detached,true);
  stage='reject-detached-native-signup';
  assert.ok((await fresh().auth.signInWithIdToken(credential())).error,'A stale broker request must not create a second account');
  assert.equal(checked(await admin.rpc('roomlet_telegram_account',{p_telegram_id:tg})),null);
  const afterTg=checked(await admin.auth.admin.getUserById(id)).user;
  assert.equal(afterTg.id,id);assert.deepEqual(afterTg.identities.map(i=>i.provider),['email']);
  const emailClient=fresh();assert.equal(checked(await emailClient.auth.signInWithPassword({email,password})).user.id,id);
  assert.ok((await emailClient.auth.unlinkIdentity(emailIdentity)).error,'Last identity cannot be removed');
  stage='reconnect-telegram';checked(await emailClient.auth.linkIdentity(credential()));
  assert.equal(checked(await emailClient.auth.getUser()).user.id,id);
  assert.equal(checked(await admin.rpc('roomlet_telegram_detached',{p_telegram_id:tg})),false);
  stage='disconnect-email';
  const telegramClient=fresh();assert.equal(checked(await telegramClient.auth.signInWithIdToken(credential())).user.id,id);
  const both=checked(await telegramClient.auth.getUser()).user;
  const proof=randomBytes(32).toString('hex');
  checked(await admin.rpc('consume_telegram_launch',{proof_hash:proof,valid_until:new Date(Date.now()+120000).toISOString()}));
  await prepare(telegramClient,both.identities.find(i=>i.provider==='email'),both.identities.find(i=>i.provider===provider),proof);
  checked(await telegramClient.auth.unlinkIdentity(both.identities.find(i=>i.provider==='email')));
  assert.ok((await telegramClient.auth.getUser()).error);
  assert.ok((await fresh().auth.signInWithPassword({email,password})).error);
  const noEmail=checked(await admin.auth.admin.getUserById(id)).user;
  assert.ok(!noEmail.email);assert.equal(noEmail.id,id);assert.equal(noEmail.identities.length,1);
  const remaining=fresh();assert.equal(checked(await remaining.auth.signInWithIdToken(credential())).user.id,id);
  stage='reconnect-email';
  checked(await admin.auth.admin.updateUserById(id,{email,email_confirm:true,password}));
  const reconnectedClient=fresh();
  assert.equal(checked(await reconnectedClient.auth.signInWithPassword({email,password})).user.id,id);
  const connected=checked(await admin.auth.admin.getUserById(id)).user;
  assert.deepEqual(connected.identities.map(i=>i.provider).sort(),[provider,'email'].sort());
  stage='verify-profile-role';
  const profile=checked(await reconnectedClient.from('profiles').select('role').eq('id',id).single());assert.equal(profile.role,'customer');
  stage='simultaneous-disconnect';
  const raceTelegram=fresh();checked(await raceTelegram.auth.signInWithIdToken(credential()));
  const raceEmail=connected.identities.find(i=>i.provider==='email'),raceTg=connected.identities.find(i=>i.provider===provider);
  const raceProof=randomBytes(32).toString('hex');
  checked(await admin.rpc('consume_telegram_launch',{proof_hash:raceProof,valid_until:new Date(Date.now()+120000).toISOString()}));
  await prepare(reconnectedClient,raceTg,raceEmail);
  await prepare(raceTelegram,raceEmail,raceTg,raceProof);
  const race=await Promise.all([reconnectedClient.auth.unlinkIdentity(raceTg),raceTelegram.auth.unlinkIdentity(raceEmail)]);
  assert.equal(race.filter(result=>!result.error).length,1,'Exactly one simultaneous unlink may succeed');
  const survivor=checked(await admin.auth.admin.getUserById(id)).user;
  assert.equal(survivor.id,id);assert.equal(survivor.identities.length,1);
  const final=fresh();
  const finalLogin=survivor.identities[0].provider==='email'?await final.auth.signInWithPassword({email,password}):await final.auth.signInWithIdToken(credential());
  assert.equal(checked(finalLogin).user.id,id);
  assert.equal(checked(await final.from('profiles').select('role').eq('id',id).single()).role,'customer');
  console.log(JSON.stringify({nativeUnlink:true,freshPermitRequired:true,lastMethodProtected:true,emailDetached:true,
    telegramDetached:true,reconnectedBoth:true,sessionsRevoked:true,uuidPreserved:true,rolePreserved:true,concurrentDisconnectProtected:true,detachedSignupPrevented:true}));
} catch(error) {
  console.log(JSON.stringify({stage,passed:false,code:typeof error.code==='string'?error.code:'assertion'}));process.exitCode=1;
} finally {
  if(id) {
    const cleanup=await admin.auth.admin.deleteUser(id);
    console.log(JSON.stringify({testAccountRemoved:!cleanup.error}));
    if(cleanup.error) process.exitCode=1;
  }
}
