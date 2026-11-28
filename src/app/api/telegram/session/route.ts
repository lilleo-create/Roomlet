import { issuerOrigin } from '@/lib/telegram/assertion.server';
import { miniEnabled } from '@/lib/telegram/config.server';
import { verifyTelegramInitData } from '@/lib/telegram/init-data.server';
import { boundedText } from '@/lib/telegram/http.server';
import { exchangeTelegram } from '@/lib/telegram/exchange.server';
import { createRoomletClient } from '@/lib/supabase/server';
import {prefersGuest,chooseGuest,deviceLaunch,rememberLaunch} from '@/lib/telegram/guest.server';

const reply=(status:number,result:string)=>Response.json({result},{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET() {
  const client=await createRoomletClient();
  const {data:{user},error}=await client.auth.getUser();
  return Response.json({authenticated:!error && Boolean(user)},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:Request) {
  if(!miniEnabled()) return reply(503,'disabled');
  try {
    const origin=issuerOrigin(process.env.ROOMLET_SITE_URL);
    const intent=request.headers.get('x-roomlet-intent');
    if(request.headers.get('origin')!==origin || !['login','link','auto'].includes(intent??'')) return reply(403,'invalid');
    const token=process.env.TELEGRAM_BOT_TOKEN;
    if(!token || !process.env.SUPABASE_SECRET_KEY) return reply(503,'configuration');
    let launch;
    try {launch=verifyTelegramInitData(await boundedText(request,16384),token);}
    catch {return reply(401,'invalid');}
    if(intent==='auto' && await prefersGuest()) return reply(200,'guest');
    const proof=intent==='link'?launch:await deviceLaunch(launch);
    const result=await exchangeTelegram(proof,intent==='link'?'link':'login',request.headers.get('x-roomlet-account'),true,request.headers.get('x-roomlet-transfer')==='yes',undefined,intent!=='auto');
    if(result.status===200 && ['signed-in','existing','created'].includes(result.result)) {
      await rememberLaunch(launch);
      if(intent==='login') await chooseGuest(false);
    }
    return reply(result.status,result.result);
  } catch {return reply(503,'unavailable');}
}
