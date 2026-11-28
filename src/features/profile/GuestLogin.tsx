'use client';
import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
import {useTelegramSession,TelegramSessionStatus} from './TelegramSession';
import {TelegramIcon} from './AuthField';
import './auth.css';

export function GuestLogin({next='/profile',privacyUrl,compact=false}:{next?:string;privacyUrl?:string;compact?:boolean}) {
  const session=useTelegramSession();
  if(!session.mini) return <div className="profile-guest-actions"><Link className="store-primary-link" href={'/profile/login?next='+encodeURIComponent(next)}>Войти <ArrowUpRight size={16} aria-hidden /></Link><Link className="profile-signin" href={'/profile/register?next='+encodeURIComponent(next)}>Создать аккаунт</Link></div>;
  const busy=['detecting','pending'].includes(session.status);
  return <div className={compact?'account-method':'profile-telegram-entry'}>
    <button className="account-telegram" type="button" disabled={busy} onClick={()=>void session.login(next)}><TelegramIcon /><span>{busy?'Входим…':'Продолжить через Telegram'}</span></button>
    <p className="account-link-copy">При входе сохраним имя и фото из Telegram для вашего профиля.{privacyUrl && <> <a className="account-text-link" href={privacyUrl} target="_blank" rel="noopener noreferrer">Политика конфиденциальности</a>.</>}</p>
    {!['detecting','pending','guest','authenticated'].includes(session.status) && <TelegramSessionStatus />}
  </div>;
}
