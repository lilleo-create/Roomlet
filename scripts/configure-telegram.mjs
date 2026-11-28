// Run inside the existing Timeweb app container; secrets stay in its environment.
import { createClient } from '@supabase/supabase-js';
const mode=process.argv[2]??'check';
if(!['check','webhook'].includes(mode)) throw Error('Use check or webhook');
const {TELEGRAM_BOT_TOKEN:token,TELEGRAM_WEBHOOK_SECRET:secret,ROOMLET_SITE_URL:origin}=process.env;
if(!token || !origin || new URL(origin).protocol!=='https:' || new URL(origin).origin!==origin) throw Error('Missing token or HTTPS origin');
const api=async(method,body)=>{
  const response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body??{}),signal:AbortSignal.timeout(15000)});
  const result=await response.json();
  if(!response.ok || !result.ok) throw Error(`Telegram ${method} failed (HTTP ${response.status})`);
  return result.result;
};
try {
  const bot=await api('getMe');
  if(bot.username!=='roomlet_shop_bot') throw Error('Wrong bot token');
  console.log('Bot identity OK: @roomlet_shop_bot');
  if(mode==='webhook') {
    if(!/^[A-Za-z0-9_-]{32,256}$/.test(secret??'')) throw Error('Set TELEGRAM_WEBHOOK_SECRET to a random value of 32–256 characters');
    const serverKey=process.env.SUPABASE_SECRET_KEY;
    if(!serverKey) throw Error('Missing SUPABASE_SECRET_KEY');
    const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
    // Null cannot produce an update receipt, but distinguishes a missing migration from a working function.
    const probe=await db.rpc('claim_telegram_update',{event_id:null});
    if(probe.error?.code!=='23502') throw Error('Webhook database migration unavailable');
    const image=await fetch(origin+'/images/telegram-welcome.png',{signal:AbortSignal.timeout(10000)});
    if(!image.ok || !image.headers.get('content-type')?.startsWith('image/png')) throw Error('Deploy bot image first');
    const denied=await fetch(origin+'/api/telegram/webhook',{method:'POST',body:'{}',signal:AbortSignal.timeout(10000)});
    if(denied.status!==403) throw Error('Webhook guard unavailable');
    await api('setWebhook',{url:origin+'/api/telegram/webhook',secret_token:secret,allowed_updates:['message'],max_connections:2,drop_pending_updates:false});
    await api('setMyCommands',{language_code:'ru',commands:[
      {command:'start',description:'Знакомство с Roomlet'},{command:'shop',description:'Смотреть коллекцию'},
      {command:'custom',description:'Создать на заказ'},{command:'orders',description:'Мои заказы'},
      {command:'favorites',description:'Избранное'},{command:'support',description:'Связаться с мастерской'},
      {command:'settings',description:'Настройки профиля'},
    ]});
    await api('setChatMenuButton',{menu_button:{type:'web_app',text:'Открыть Roomlet',web_app:{url:origin+'/mini'}}});
    console.log('Webhook, Russian commands and Menu Button configured');
  }
  const info=await api('getWebhookInfo');
  console.log(JSON.stringify({webhookMatches:info.url===origin+'/api/telegram/webhook',pending:info.pending_update_count,lastErrorAt:info.last_error_date??null}));
} catch(error) {
  // Deliberately omit underlying FetchError and Telegram response bodies (URLs contain tokens).
  console.error(error instanceof Error && /^(Telegram |Wrong bot|Set TELEGRAM|Missing |Webhook |Deploy )/.test(error.message)?error.message:'Telegram configuration request failed');
  process.exitCode=1;
}
