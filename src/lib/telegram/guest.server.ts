import 'server-only';
import {cookies} from 'next/headers';
import {createHmac,randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import type {TelegramLaunch} from './init-data.server';

const options={path:'/',httpOnly:true,secure:true,sameSite:'none' as const,partitioned:true};
const preference='__Host-roomlet-guest';
const proofCookie='__Host-roomlet-launch';
export async function prefersGuest(){return (await cookies()).get(preference)?.value==='yes';}
export async function chooseGuest(value:boolean){(await cookies()).set(preference,value?'yes':'',{...options,maxAge:value?31536000:0});}
const signature=(body:string)=>createHmac('sha256',process.env.TELEGRAM_BOT_TOKEN??'').update('roomlet-device-proof:'+body).digest('hex');

// A consumed launch can be deliberately used again only by the browser that
// received its rotating HttpOnly receipt. Every receipt is itself single-use.
export async function deviceLaunch(launch:TelegramLaunch):Promise<TelegramLaunch> {
  const value=(await cookies()).get(proofCookie)?.value;
  if(!value || value.length>1024) return launch;
  const [body,sig]=value.split('.');
  if(!body || !/^[a-f0-9]{64}$/.test(sig??'')) return launch;
  if(!timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(signature(body),'hex'))) return launch;
  try {
    const receipt=JSON.parse(Buffer.from(body,'base64url').toString());
    if(receipt.source!==launch.replayKey || receipt.exp<=Date.now()/1000 || typeof receipt.nonce!=='string') return launch;
    return {...launch,replayKey:createHash('sha256').update('roomlet-device-proof:'+body).digest('hex')};
  } catch{return launch;}
}
export async function rememberLaunch(launch:TelegramLaunch) {
  const body=Buffer.from(JSON.stringify({source:launch.replayKey,exp:launch.expiresAt,nonce:randomBytes(24).toString('hex')})).toString('base64url');
  (await cookies()).set(proofCookie,body+'.'+signature(body),{...options,maxAge:Math.max(0,launch.expiresAt-Math.floor(Date.now()/1000))});
}
