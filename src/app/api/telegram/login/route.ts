import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createRoomletClient } from '@/lib/supabase/server';
import { authDestination } from '@/features/profile/auth-paths';
import { webTelegramConfig } from '@/lib/telegram/config.server';
import { recentlyAuthenticated } from '@/lib/telegram/assertion.server';
import { authorizationUrl, createWebFlow, sealWebFlow } from '@/lib/telegram/oidc';

export async function GET(request:Request) {
  try {
    const config=webTelegramConfig();
    const url=new URL(request.url);
    const intent=url.searchParams.get('intent')==='link'?'link':'login';
    const next=authDestination(url.searchParams.get('next'));
    // Telegram Web embeds Mini Apps. The OIDC consent page rejects framing.
    if(request.headers.get('sec-fetch-dest')==='iframe') {
      return NextResponse.redirect(new URL('/mini?next='+encodeURIComponent(next),config.origin),303);
    }
    const client=await createRoomletClient();
    const {data:{user}}=await client.auth.getUser();
    if(intent==='login' && user) return NextResponse.redirect(new URL(next,config.origin));
    if(intent==='link') {
      // A same-origin confirmation form is required; GET cannot start account linking.
      return NextResponse.redirect(new URL('/profile/telegram',config.origin));
    }
    return start(config,createWebFlow(intent,null,next));
  } catch {return new Response('Вход через Telegram пока недоступен.',{status:503,headers:{'Cache-Control':'no-store'}});}
}
export async function POST(request:Request) {
  try {
    const config=webTelegramConfig();
    if(request.headers.get('origin')!==config.origin) return new Response(null,{status:403});
    if(request.headers.get('sec-fetch-dest')==='iframe')
      return NextResponse.redirect(new URL('/mini/link',config.origin),303);
    const client=await createRoomletClient();
    const {data:{user}}=await client.auth.getUser();
    const {data}=await client.auth.getClaims();
    if(!user?.email || !user.email_confirmed_at || data?.claims.sub!==user.id || !recentlyAuthenticated(data.claims.amr))
      return NextResponse.redirect(new URL('/profile/login?next=/profile/telegram',config.origin),303);
    const form=await request.formData();
    const flow=createWebFlow('link',user.id,'/profile/settings');
    flow.allowTransfer=form.get('allow_transfer')==='yes';
    return start(config,flow);
  } catch {return new Response('Привязка Telegram пока недоступна.',{status:503,headers:{'Cache-Control':'no-store'}});}
}
async function start(config:ReturnType<typeof webTelegramConfig>,flow:ReturnType<typeof createWebFlow>) {
  (await cookies()).set('__Host-roomlet-telegram-flow',sealWebFlow(flow,config.flowSecret),{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:300});
  const response=NextResponse.redirect(authorizationUrl(flow,config.clientId,config.callback),303);
  response.headers.set('Cache-Control','private, no-store');
  response.headers.set('Referrer-Policy','no-referrer');
  return response;
}
