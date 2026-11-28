"use server";
import { headers, cookies } from 'next/headers';
import { readAccount } from './session';
import { authMailOrigin, authHref } from './auth-paths';
import { createRoomletClient } from '@/lib/supabase/server';
import { localDemoEnabled, supabaseConfig } from '@/lib/supabase/config';

export type ContactConfirmationState = { error?: string; sent?: boolean };
export async function requestContactConfirmation(): Promise<ContactConfirmationState> {
  const account = await readAccount();
  if (!account?.contactEmail) return {error:'Сначала сохраните контактный адрес.'};
  if (account.emailConfirmed) return {error:'Для входа уже подключена подтверждённая почта.'};
  const origin = authMailOrigin(localDemoEnabled() ? undefined : process.env.ROOMLET_SITE_URL,(await headers()).get('host'));
  if (!origin) return {error:'Отправка писем пока недоступна. Адрес сохранён как неподтверждённый контакт.'};
  const jar = await cookies();
  if (Number(jar.get('roomlet-contact-mail')?.value) > Date.now()) return {error:'Подождите минуту перед повторной отправкой.'};
  const client = await createRoomletClient();
  // Fail closed if Auth would silently confirm a newly supplied address.
  const {url,key} = supabaseConfig();
  try {
    const settings = await fetch(url+'/auth/v1/settings',{headers:{apikey:key},cache:'no-store',signal:AbortSignal.timeout(5000)});
    const config = settings.ok ? await settings.json() : null;
    if (config?.mailer_autoconfirm !== false || config?.external?.email !== true)
      return {error:'Подтверждение почты пока недоступно. Адрес остаётся только контактным.'};
  } catch { return {error:'Сервис почты недоступен. Контактный адрес сохранён.'}; }
  const {error} = await client.auth.updateUser({email:account.contactEmail},{emailRedirectTo:new URL(authHref('confirm','/profile/settings'),origin).href});
  if (error) return {error:error.status === 429 ? 'Слишком много запросов. Попробуйте позже.'
    : 'Письмо отправить не удалось. Адрес сохранён как неподтверждённый контакт. Вход через Telegram продолжает работать.'};
  jar.set('roomlet-contact-mail',String(Date.now()+60000),{httpOnly:true,secure:origin.startsWith('https:'),sameSite:'lax',path:'/profile',maxAge:60});
  return {sent:true};
}
