import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createRoomletClient } from '@/lib/supabase/server';
import { webTelegramConfig } from '@/lib/telegram/config.server';
import { openWebFlow, verifyTelegramToken } from '@/lib/telegram/oidc';
import { exchangeTelegram } from '@/lib/telegram/exchange.server';
import { authDestination } from '@/features/profile/auth-paths';
import { telegramFailure } from '@/lib/telegram/diagnostics.server';

export async function GET(request:Request) {
  const jar=await cookies();
  const raw=jar.get('__Host-roomlet-telegram-flow')?.value;
  jar.set('__Host-roomlet-telegram-flow','',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});
  let destination='/profile/login?telegram=error';
  let origin:string;
  let stage='callback';
  try {origin=webTelegramConfig().origin;} catch {return new Response('Вход через Telegram пока недоступен.',{status:503});}
  try {
    const config=webTelegramConfig();
    const params=new URL(request.url).searchParams;
    if(!raw || params.getAll('state').length!==1 || params.getAll('code').length!==1) throw Error('Invalid callback');
    const flow=openWebFlow(raw,config.flowSecret,params.get('state')!);
    destination=flow.intent==='link'?'/profile/telegram?error=callback':destination;
    stage='session';
    const client=await createRoomletClient();
    const {data:{user}}=await client.auth.getUser();
    // Do not attach an identity to a session that changed in another tab.
    if((user?.id??null)!==flow.accountId) throw Error('Session changed');
    const code=params.get('code')!;
    if(code.length>4096) throw Error('Invalid code');
    stage='code-exchange';
    const response=await fetch('https://oauth.telegram.org/token',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(10000),
      headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:'Basic '+Buffer.from(config.clientId+':'+config.clientSecret).toString('base64')},
      body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:config.callback,client_id:config.clientId,code_verifier:flow.verifier})});
    if(!response.ok) { telegramFailure(stage,undefined,response.status); throw Error('Code exchange failed'); }
    const tokens=await response.json();
    if(typeof tokens.id_token!=='string' || tokens.id_token.length>16384) throw Error('Missing token');
    stage='verify-token';
    const launch=await verifyTelegramToken(tokens.id_token,config.clientId,flow.nonce);
    stage='exchange-session';
    const result=await exchangeTelegram(launch,flow.intent,flow.accountId,false,flow.allowTransfer===true);
    if(result.status===200) destination=flow.intent==='link'?'/profile/settings?telegram=linked':authDestination(flow.next);
    else if(result.result==='reauth') destination='/profile/login?next=/profile/telegram';
    else if(result.result==='conflict') destination='/profile/settings?telegram=conflict';
    else if(result.result==='merge-required') destination='/profile/telegram?confirm=merge';
    else if(flow.intent==='link') destination='/profile/telegram?error='+encodeURIComponent(result.result);
  } catch (error) {
    const reference=telegramFailure(stage,typeof error==='object' && error && 'code' in error ? String(error.code) : undefined);
    destination += '&reference='+reference;
  }
  const response=NextResponse.redirect(new URL(destination,origin),303);
  response.headers.set('Cache-Control','private, no-store');
  response.headers.set('Referrer-Policy','no-referrer');
  return response;
}
