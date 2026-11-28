import 'server-only';
import { createHash } from 'node:crypto';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createRoomletClient } from '@/lib/supabase/server';
import { telegramAdmin } from '@/lib/telegram/http.server';
import { createAssertion,provider } from '@/lib/telegram/assertion.server';
import { issuerConfig } from '@/lib/telegram/config.server';
import type { TelegramLaunch } from '@/lib/telegram/init-data.server';

export async function loginMethods(userId:string) {
  const {data,error}=await telegramAdmin().rpc('roomlet_login_methods',{p_user:userId});
  if(error || !data) throw Error('Не удалось проверить способы входа.');
  return {emailReady:data.email_ready===true,telegramReady:data.telegram_ready===true};
}

export async function disconnectIdentity(client:SupabaseClient,user:User,method:'email'|'telegram',proof?:string) {
  const removed=user.identities?.find(i=>i.provider===(method==='email'?'email':provider));
  const retained=user.identities?.find(i=>i.provider===(method==='email'?provider:'email'));
  const {data:claims,error:claimsError}=await client.auth.getClaims();
  if(!removed || !retained || claimsError || claims?.claims.sub!==user.id || typeof claims.claims.session_id!=='string')
    throw Error('Подтвердите оставшийся способ входа ещё раз.');
  const prepared=await telegramAdmin().rpc('roomlet_prepare_disconnect',{p_user:user.id,
    p_identity:removed.identity_id,p_retained:retained.identity_id,p_session:claims.claims.session_id,p_proof:proof??null});
  if(prepared.error) throw Error('Нельзя отключить последний настроенный способ входа. Проверьте настройки и повторите подтверждение.');
  // A guarded native Auth transaction consumes the permit, revokes sessions and
  // clears email credentials/tokens. Any Auth failure rolls the whole change back.
  const result=await client.auth.unlinkIdentity(removed);
  if(result.error) throw Error('Отключение не завершено. Способы входа сохранены. Попробуйте ещё раз.');
  await (await createRoomletClient()).auth.signOut({scope:'local'});
}

export async function disconnectEmailWithTelegram(launch:TelegramLaunch,accountId:string,mini=false):Promise<boolean> {
  const client=await createRoomletClient();
  const {data:{user},error}=await client.auth.getUser();
  const identity=user?.identities?.find(i=>i.provider===provider);
  if(error || !user || user.id!==accountId || identity?.identity_data?.sub!=='tg:'+launch.telegramId)
    throw Error('Подтвердите Telegram, подключённый к этому аккаунту.');
  // A distinct purpose allows deliberate fresh Mini App confirmation after its
  // launch was used for sign-in. It can authorize this operation only once.
  const proof=createHash('sha256').update('disconnect-email:'+launch.replayKey).digest('hex');
  const used=await telegramAdmin().rpc('consume_telegram_launch',{proof_hash:proof,valid_until:new Date(launch.expiresAt*1000).toISOString()});
  if(used.error || used.data!==true) throw Error('Подтверждение истекло или уже использовано. Откройте приложение из Telegram заново.');
  await disconnectIdentity(client,user,'email',proof);
  // The explicit proof is still fresh. Restore access through the remaining
  // identity in a NEW session after revoking every previous session.
  const resumed=await createRoomletClient(mini?'telegram':'account');
  try {
    const {origin,keys}=issuerConfig();
    const result=await resumed.auth.signInWithIdToken(createAssertion(launch,origin,keys));
    const current=await telegramAdmin().rpc('roomlet_telegram_account',{p_telegram_id:launch.telegramId});
    if(result.error || result.data.user?.id!==accountId || current.error || current.data!==accountId) {
      await resumed.auth.signOut({scope:'local'});return false;
    }
    return true;
  } catch {await resumed.auth.signOut({scope:'local'});return false;}
}
