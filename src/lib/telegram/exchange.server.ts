import 'server-only';
import { isAuthSessionMissingError } from '@supabase/supabase-js';
import { createRoomletClient } from '@/lib/supabase/server';
import { issuerConfig } from './config.server';
import { createAssertion, provider, recentlyAuthenticated } from './assertion.server';
import { telegramAdmin } from './http.server';
import type { TelegramLaunch } from './init-data.server';

export async function exchangeTelegram(launch:TelegramLaunch,intent:'login'|'link',accountId?:string|null,mini = false,allowTransfer = false) {
  const reply=(status:number,result:string)=>({status,result});
  const client=await createRoomletClient();
  const {data,error}=await client.auth.getUser();
  let user=data.user;
  if(error && !isAuthSessionMissingError(error) && !(intent==='login' && (error.status===401 || error.code==='user_banned'))) return reply(401,'session');
  if(intent==='login' && user) {
    const merged=await telegramAdmin().rpc('roomlet_telegram_account_merged',{p_user_id:user.id});
    if(merged.error) return reply(503,'storage');
    if(merged.data===true) { await client.auth.signOut({scope:'local'}); user=null; }
  }
  const identity=user?.identities?.find(identity=>identity.provider===provider);
  if(intent==='login' && user) {
    if(identity && identity.identity_data?.sub!=='tg:'+launch.telegramId) return reply(409,'conflict');
    return reply(200,'existing');
  }
  if(intent==='link') {
    if(!user || !user.email || !user.email_confirmed_at || accountId!==user.id) return reply(401,'reauth');
    const {data}=await client.auth.getClaims();
    if(data?.claims.sub!==user.id || !recentlyAuthenticated(data.claims.amr)) return reply(401,'reauth');
    if(identity) return identity.identity_data?.sub==='tg:'+launch.telegramId?reply(200,'linked'):reply(409,'conflict');
  }
  const used=await telegramAdmin().rpc('consume_telegram_launch',{proof_hash:launch.replayKey,valid_until:new Date(launch.expiresAt*1000).toISOString()});
  if(used.error) return reply(503,'storage');
  if(used.data!==true) return reply(409,'reopen');
  if(intent==='link' && allowTransfer && user) {
    const moved=await telegramAdmin().rpc('roomlet_transfer_telegram',{
      p_target:user.id,p_telegram_id:launch.telegramId,p_proof_hash:launch.replayKey,
    });
    if(moved.error) return reply(moved.error.code==='42501'?409:503,moved.error.code==='42501'?'conflict':'storage');
    if(moved.data===true) {
      await client.auth.refreshSession();
      return reply(200,'linked');
    }
  }
  const {origin,keys}=issuerConfig();
  const credentials=createAssertion(launch,origin,keys);
  const signInClient=mini && intent==='login' ? await createRoomletClient('telegram') : client;
  const result=intent==='link'?await client.auth.linkIdentity(credentials):await signInClient.auth.signInWithIdToken(credentials);
  if(result.error || !result.data.user || !result.data.session)
    return reply(result.error?.code==='identity_already_exists'?409:503,result.error?.code==='identity_already_exists'?'conflict':'exchange');
  if(intent==='link' && result.data.user.id!==user?.id) {
    await client.auth.signOut({scope:'local'});
    return reply(403,'session');
  }
  return reply(200,intent==='link'?'linked':'signed-in');
}
