'use client';
import { useActionState,useState } from 'react';
import { Button,Dialog,Input } from '@/components/ui';
import { Checkbox } from '@/components/Checkbox';
import { useTelegramSession } from './TelegramSession';
import { disconnectMethod } from './disconnect-actions';

export function DisconnectMethod({method,allowed,email,webAvailable}:{method:'email'|'telegram';allowed:boolean;email?:string;webAvailable:boolean}) {
  const [open,setOpen]=useState(false),[confirmed,setConfirmed]=useState(false),[password,setPassword]=useState('');
  const [state,action,pending]=useActionState(disconnectMethod,{});
  const telegram=useTelegramSession();
  const label=method==='email'?'Отключить почту':'Отключить Telegram';
  const web=method==='email' && !telegram.mini;
  function close(){if(!pending){setOpen(false);setConfirmed(false);setPassword('');}}
  return <>
    <button type="button" className="profile-disconnect-link" onClick={()=>setOpen(true)}>{label}</button>
    <Dialog open={open} onClose={close} title={label+'?'}>
      <div className="profile-disconnect-dialog">
        <p>{method==='email'?'Вход и восстановление пароля через эту почту станут недоступны. Войти можно будет через Telegram.':'Вход через Telegram станет недоступен. Войти можно будет с почтой и паролем.'}</p>
        <p>Профиль, заказы и настройки сохранятся. Все текущие сеансы завершатся. Способ входа можно подключить снова.</p>
        {!allowed ? <><p role="status">{method==='telegram'?'Сначала подключите и подтвердите почту и установите пароль.':'Сначала подключите Telegram.'} Последний настроенный способ входа отключить нельзя.</p>
          <Button type="button" onClick={close}>Понятно</Button></> : web && !webAvailable ? <p role="status">Подтверждение через Telegram сейчас недоступно. Попробуйте позже.</p>
        : <form action={web?'/api/telegram/login':action} method={web?'post':undefined} aria-busy={pending}
          onReset={()=>{setConfirmed(false);setPassword('');}}
          onSubmit={event=>{
            if(method==='email' && telegram.mini) {
              const app=(window as Window & {Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp;
              const input=event.currentTarget.elements.namedItem('initData') as HTMLInputElement;
              input.value=app?.initData??'';
            }
          }}>
          <input type="hidden" name="method" value={method} />
          <input type="hidden" name="intent" value="disconnect-email" />
          <input type="hidden" name="initData" defaultValue="" />
          {method==='telegram' && <><p>Подтвердите вход для {email}.</p><Input label="Пароль" type="password" name="password" autoComplete="current-password" required maxLength={256} value={password} onChange={event=>setPassword(event.target.value)} /></>}
          <Checkbox name="confirm" value="yes" required checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}>Подтверждаю отключение</Checkbox>
          {state.error && <p className="profile-settings-error" role="alert">{state.error}</p>}
          <div className="profile-disconnect-actions"><Button type="button" variant="secondary" onClick={close} disabled={pending}>Отмена</Button>
            <Button type="submit" disabled={!confirmed || pending || method==='telegram'&&!password || method==='email'&&telegram.status==='detecting'}>{pending?'Отключаем…':web?'Подтвердить в Telegram':'Отключить'}</Button></div>
        </form>}
      </div>
    </Dialog>
  </>;
}
