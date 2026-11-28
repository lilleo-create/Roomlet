import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createRoomletClient } from '@/lib/supabase/server';
import { webTelegramConfig } from '@/lib/telegram/config.server';
import { openWebFlow, verifyTelegramToken } from '@/lib/telegram/oidc';
import { exchangeTelegram } from '@/lib/telegram/exchange.server';
import { authDestination } from '@/features/profile/auth-paths';

export async function GET(request:Request) {
  const jar=await cookies();
  const raw=jar.get('__Host-roomlet-telegram-flow')?.value;
  jar.set('__Host-roomlet-telegram-flow','',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});
  let destination='/profile/login?telegram=error';
  let origin:string;
  try {origin=webTelegramConfig().origin;} catch {return new Response('Вход через Telegram пока недоступен.',{status:503});}
  try {
    const config=webTelegramConfig();
    const params=new URL(request.url).searchParams;
    if(!raw || params.getAll('state').length!==1 || params.getAll('code').length!==1) throw Error('Invalid callback');
    const flow=openWebFlow(raw,config.flowSecret,params.get('state')!);
    destination=flow.intent==='link'?'/profile/settings?telegram=error':destination;
    const client=await createRoomletClient();
    const {data:{user}}=await client.auth.getUser();
    // Do not attach an identity to a session that changed in another tab.
    if((user?.id??null)!==flow.accountId) throw Error('Session changed');
    const code=params.get('code')!;
    if(code.length>4096) throw Error('Invalid code');
    const response=await fetch('https://oauth.telegram.org/token',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(10000),
      headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:'Basic '+Buffer.from(config.clientId+':'+config.clientSecret).toString('base64')},
      body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:config.callback,client_id:config.clientId,code_verifier:flow.verifier})});
    if(!response.ok) throw Error('Code exchange failed');
    const tokens=await response.json();
    if(typeof tokens.id_token!=='string' || tokens.id_token.length>16384) throw Error('Missing token');
    const launch=await verifyTelegramToken(tokens.id_token,config.clientId,flow.nonce);
    const result=await exchangeTelegram(launch,flow.intent,flow.accountId);
    if(result.status===200) destination=flow.intent==='link'?'/profile/settings?telegram=linked':authDestination(flow.next);
    else if(result.result==='reauth') destination='/profile/login?next=/profile/telegram';
    else if(result.result==='conflict') destination='/profile/settings?telegram=conflict';
  } catch { /* Do not log codes, tokens, identity data, or provider error bodies. */ }
  const response=NextResponse.redirect(new URL(destination,origin),303);
  response.headers.set('Cache-Control','private, no-store');
  response.headers.set('Referrer-Policy','no-referrer');
  return response;
}
