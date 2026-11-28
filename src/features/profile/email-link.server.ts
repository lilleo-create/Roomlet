import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { supabaseConfig } from '@/lib/supabase/config';
import { hasMiniSession } from '@/lib/supabase/mini-cookies';
import { telegramAdmin } from '@/lib/telegram/http.server';
import { openEmailProof,sealEmailProof,type EmailProof } from './email-proof';

export type EmailGate={allowed:boolean;active:boolean;flow_id:string;email:string;phase:'code'|'old'|'merge'|'done';kind:'change'|'existing';expires_at:string;retry_at:string};
export async function emailGate(user:string,action:string,flow?:string,email?:string):Promise<EmailGate> {
  const result=await telegramAdmin().rpc('roomlet_email_gate',{p_user:user,p_action:action,p_flow:flow??null,p_email:email??null});
  if(result.error) throw Error('Email verification storage unavailable');
  return {...result.data,active:Boolean(result.data?.flow_id&&result.data.phase!=='done'&&Date.parse(result.data.expires_at)>Date.now())};
}
export function isolatedEmailClient() {
  const {url,key}=supabaseConfig();
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export async function emailConfirmationEnabled() {
  const {url,key}=supabaseConfig();
  const response=await fetch(url+'/auth/v1/settings',{headers:{apikey:key},cache:'no-store',signal:AbortSignal.timeout(5000)});
  const settings=response.ok?await response.json():null;
  return settings?.mailer_autoconfirm===false && settings?.external?.email===true;
}
async function proofOptions() {
  const jar=await cookies(),mini=hasMiniSession(jar.getAll());
  return {httpOnly:true,secure:true,path:'/',sameSite:mini?'none' as const:'lax' as const,partitioned:mini,maxAge:300};
}
export async function rememberEmailProof(proof:EmailProof) {
  const secret=process.env.ROOMLET_TELEGRAM_SIGNING_KEY;
  if(!secret) throw Error('Email linking unavailable');
  (await cookies()).set('__Host-roomlet-email-proof',sealEmailProof(proof,secret),await proofOptions());
}
export async function readEmailProof(source:string,flow:string) {
  const raw=(await cookies()).get('__Host-roomlet-email-proof')?.value;
  if(!raw||!process.env.ROOMLET_TELEGRAM_SIGNING_KEY) return null;
  try{return openEmailProof(raw,process.env.ROOMLET_TELEGRAM_SIGNING_KEY,source,flow);}catch{return null;}
}
export async function clearEmailProof() {(await cookies()).set('__Host-roomlet-email-proof','',{...await proofOptions(),maxAge:0});}
