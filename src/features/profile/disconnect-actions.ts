'use server';
import { redirect } from 'next/navigation';
import { createRoomletClient } from '@/lib/supabase/server';
import { verifyTelegramInitData } from '@/lib/telegram/init-data.server';
import { isolatedEmailClient } from './email-link.server';
import { disconnectEmailWithTelegram,disconnectIdentity } from './disconnect.server';

export async function disconnectMethod(_previous:{error?:string},form:FormData):Promise<{error?:string}> {
  if(form.get('confirm')!=='yes') return {error:'Подтвердите отключение.'};
  const method=form.get('method');
  if(method!=='telegram' && method!=='email') return {error:'Выберите способ входа.'};
  const original=await createRoomletClient();
  const {data:{user},error}=await original.auth.getUser();
  if(error || !user) return {error:'Войдите в аккаунт снова.'};
  let resumed=false;
  if(method==='telegram') {
    const password=form.get('password');
    if(!user.email || !user.email_confirmed_at || typeof password!=='string' || !password || password.length>256)
      return {error:'Подтвердите вход паролем от вашей почты.'};
    const proof=isolatedEmailClient();
    const result=await proof.auth.signInWithPassword({email:user.email,password});
    if(result.error || result.data.user?.id!==user.id) {
      if(result.data.session) await proof.auth.signOut({scope:'local'});
      return {error:'Не удалось подтвердить пароль. Проверьте его и попробуйте ещё раз.'};
    }
    try {await disconnectIdentity(proof,result.data.user,'telegram');}
    catch(error) {return {error:error instanceof Error?error.message:'Отключение не завершено.'};}
    finally {await proof.auth.signOut({scope:'local'});}
  } else {
    try {
      const raw=form.get('initData');
      if(typeof raw!=='string') throw Error();
      const launch=verifyTelegramInitData(raw,process.env.TELEGRAM_BOT_TOKEN??'');
      resumed=await disconnectEmailWithTelegram(launch,user.id,true);
    } catch {return {error:'Не удалось подтвердить Telegram. Закройте мини-приложение, откройте его снова из бота и повторите действие.'};}
  }
  redirect(resumed?'/profile/settings?disconnected=email':'/profile/login?next=/profile/settings&disconnected='+method);
}
