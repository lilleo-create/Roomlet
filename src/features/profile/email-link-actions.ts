'use server';
import { createHash,randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createRoomletClient } from '@/lib/supabase/server';
import { telegramAdmin } from '@/lib/telegram/http.server';
import { provider } from '@/lib/telegram/assertion.server';
import { emailGate,isolatedEmailClient,emailConfirmationEnabled,rememberEmailProof,readEmailProof,clearEmailProof } from './email-link.server';

export type EmailLinkState={step:'address'|'code'|'old'|'merge'|'success';email:string;flow?:string;retryAt?:number;error?:string};
const field=(form:FormData,name:string)=>typeof form.get(name)==='string'?String(form.get(name)):'';
const failure='Не удалось подтвердить почту. Попробуйте ещё раз. Ваш аккаунт сохранён.';

export async function submitEmailLink(previous:EmailLinkState,form:FormData):Promise<EmailLinkState> {
  const client=await createRoomletClient();
  const {data:{user}}=await client.auth.getUser();
  if(!user) return {...previous,error:'Войдите в аккаунт ещё раз.'};
  const action=field(form,'intent');
  const identity=user.identities?.find(i=>i.provider===provider);
  try {
    if(action==='send') {
      const email=field(form,'email').trim().toLowerCase();
      if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return {step:'address',email,error:'Укажите корректный адрес почты.'};
      if(user.email_confirmed_at&&user.email?.toLowerCase()===email) return {step:'success',email};
      if(!await emailConfirmationEnabled()) return {step:'address',email,error:'Отправка подтверждений пока недоступна. Попробуйте позже.'};
      // Changing an existing email requires its password, in addition to Auth's
      // secure confirmation of both old and new addresses. This client has no cookies.
      if(user.email&&user.email_confirmed_at) {
        const password=field(form,'current_password');
        if(!password||password.length>128) return {step:'address',email,error:'Введите текущий пароль для смены почты.'};
        const check=isolatedEmailClient();
        const verified=await check.auth.signInWithPassword({email:user.email,password});
        const valid=!verified.error&&verified.data.user?.id===user.id;
        if(verified.data.session) await check.auth.signOut({scope:'local'});
        if(!valid) return {step:'address',email,error:'Проверьте текущий пароль.'};
      }
      const flow=randomUUID(),gate=await emailGate(user.id,'start',flow,email);
      if(!gate.allowed) return {...previous,email,error:'Подождите перед повторной отправкой.',retryAt:Date.parse(gate.retry_at)};
      await clearEmailProof();
      const change=await client.auth.updateUser({email});
      let error=change.error;
      if(error?.code==='email_exists') {
        await emailGate(user.id,'existing',flow);
        // Existing account ownership is proven by Auth OTP. Never create an account here.
        const sent=await isolatedEmailClient().auth.signInWithOtp({email,options:{shouldCreateUser:false}});
        error=sent.error;
      }
      if(error) return {step:'address',email,error:error.status===429?'Слишком много запросов. Попробуйте позже.':'Не удалось отправить письмо. Попробуйте позже.',retryAt:Date.parse(gate.retry_at)};
      return {step:'code',email,flow,retryAt:Date.parse(gate.retry_at)};
    }
    const flow=field(form,'flow');
    if(!/^[\da-f-]{36}$/.test(flow)) return {...previous,error:failure};
    const gate=await emailGate(user.id,'read');
    if(gate.flow_id!==flow||Date.parse(gate.expires_at)<=Date.now()||gate.phase==='done') return {...previous,error:'Код истёк. Запросите новое письмо.'};
    const state:EmailLinkState={step:gate.phase==='old'?'old':gate.phase==='merge'?'merge':'code',email:gate.email,flow,retryAt:Date.parse(gate.retry_at)};
    if(action==='verify') {
      const token=field(form,'otp');
      if(!/^\d{6}$/.test(token)) return {...state,error:'Введите шесть цифр из письма.'};
      if(!(await emailGate(user.id,'attempt',flow)).allowed) return {...state,error:'Попытки закончились. Запросите новое письмо.'};
      const verification=isolatedEmailClient();
      const result=await verification.auth.verifyOtp({email:gate.phase==='old'?user.email!:gate.email,token,type:gate.kind==='existing'?'email':'email_change'});
      if(result.error) return {...state,error:'Код неверный или истёк. Проверьте последнее письмо.'};
      if(!result.data.session && gate.kind==='change' && user.email) {
        await emailGate(user.id,'old',flow);
        return {...state,step:'old'};
      }
      const target=result.data.user,session=result.data.session;
      if(!target||!session||!target.email_confirmed_at||target.email?.toLowerCase()!==gate.email) return {...state,error:failure};
      if(target.id!==user.id) {
        if(!identity||user.email||target.factors?.some(f=>f.status==='verified')) {await verification.auth.signOut({scope:'local'});return {...state,error:'Для этого аккаунта подключите Telegram из настроек после входа по почте.'};}
        await rememberEmailProof({source:user.id,flow,target:target.id,email:gate.email,refresh_token:session.refresh_token,expires:Date.now()+300000});
        await emailGate(user.id,'merge',flow);
        return {...state,step:'merge'};
      }
      const saved=await client.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token});
      if(saved.error) return {...state,error:'Почта подтверждена. Войдите в аккаунт ещё раз.'};
      await emailGate(user.id,'finish',flow);
      revalidatePath('/profile','layout');
      return {step:'success',email:gate.email};
    }
    if(action==='merge'&&gate.phase==='merge') {
      if(form.get('allow_transfer')!=='yes') return {...state,error:'Подтвердите объединение аккаунтов.'};
      const proof=await readEmailProof(user.id,flow);
      const telegramId=identity?.identity_data?.sub?.replace(/^tg:/,'');
      if(!proof||typeof telegramId!=='string'||!/^[1-9][0-9]{0,15}$/.test(telegramId)||user.email) return {...state,error:'Подтверждение истекло. Получите новый код.'};
      const verification=isolatedEmailClient();
      const verified=await verification.auth.refreshSession({refresh_token:proof.refresh_token});
      if(verified.error||verified.data.user?.id!==proof.target||!verified.data.user.email_confirmed_at||verified.data.user.email?.toLowerCase()!==proof.email||!verified.data.session||verified.data.user.factors?.some(f=>f.status==='verified')) return {...state,error:failure};
      await rememberEmailProof({...proof,refresh_token:verified.data.session.refresh_token});
      const hash=createHash('sha256').update('email-link:'+user.id+':'+flow).digest('hex');
      const admin=telegramAdmin();
      const used=await admin.rpc('consume_telegram_launch',{proof_hash:hash,valid_until:new Date(proof.expires).toISOString()});
      if(used.error) return {...state,error:failure};
      const transfer=await admin.rpc('roomlet_transfer_telegram',{p_target:proof.target,p_telegram_id:telegramId,p_proof_hash:hash});
      if(transfer.error||transfer.data!==true) return {...state,error:'Объединение не выполнено. Оба аккаунта и их данные сохранены.'};
      const session=verified.data.session;
      const saved=await client.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token});
      await clearEmailProof();
      if(saved.error) return {...state,error:'Аккаунты объединены. Закройте и снова откройте Roomlet для входа.'};
      revalidatePath('/profile','layout');
      return {step:'success',email:proof.email};
    }
    return {...previous,error:failure};
  } catch {return {...previous,error:failure};}
}

export async function saveLinkedPassword(_state:{error?:string;saved?:boolean},form:FormData) {
  const client=await createRoomletClient();
  const {data:{user}}=await client.auth.getUser();
  const {data}=await client.auth.getClaims();
  const now=Math.floor(Date.now()/1000);
  const fresh=Array.isArray(data?.claims.amr)&&data.claims.amr.some(a=>a!==null&&typeof a==='object'&&['otp','password'].includes(a.method)&&a.timestamp<=now&&now-a.timestamp<300);
  if(!user?.email_confirmed_at||!user.email||data?.claims.sub!==user.id||!fresh) return {error:'Для установки пароля подтвердите адрес ещё раз через восстановление доступа.'};
  const password=field(form,'password');
  if(password.length<8||password.length>128) return {error:'Используйте от 8 до 128 символов.'};
  const {error}=await client.auth.updateUser({password});
  return error?{error:'Не удалось сохранить пароль. Выберите другой пароль или запросите восстановление.'}:{saved:true};
}
