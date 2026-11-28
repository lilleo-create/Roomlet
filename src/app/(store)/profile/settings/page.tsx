import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ChevronRight, Bell, LogOut, Send, Mail } from 'lucide-react';
import { PageHeading } from '@/components/ui';
import { readAccount } from '@/features/profile/session';
import { miniEnabled, webTelegramEnabled } from '@/lib/telegram/config.server';
import { ProfileSettingsForm } from '@/features/profile/ProfileSettingsForm';
import { emailGate } from '@/features/profile/email-link.server';
import { leaveProfile } from '../actions';
import './settings.css';

export default async function ProfileSettings({ searchParams }: { searchParams: Promise<{ telegram?: string }> }) {
  const account = await readAccount();
  if (!account) redirect('/profile/login?next=/profile/settings');
  const {telegram} = await searchParams;
  const emailState=await emailGate(account.id,'read');
  const pendingEmail=emailState.active;
  return <section className="store-page store-narrow profile-subpage profile-settings">
    <Link href="/profile" className="store-back"><ArrowLeft size={16} aria-hidden /> Мой профиль</Link>
    <PageHeading title="Настройки профиля" />
    {telegram === 'linked' && <p role="status">Telegram подключён. Все ваши заказы доступны в этом аккаунте.</p>}
    {telegram === 'conflict' && <p role="alert">Telegram уже связан с другим аккаунтом. Подтвердите перенос при привязке.</p>}
    {telegram === 'error' && <p role="alert">Привязка не завершена. Попробуйте ещё раз.</p>}
    <section className="profile-settings-section" aria-labelledby="personal-heading">
      <h2 id="personal-heading">Личные данные</h2>
      <ProfileSettingsForm name={account.name} email={account.contactEmail} phone={account.contactPhone}
        avatar={account.avatar} confirmedEmail={account.emailConfirmed ? account.email : ''} />
    </section>
    <section className="profile-settings-section" aria-labelledby="login-heading">
      <h2 id="login-heading">Способы входа</h2>
      <div className="profile-settings-method"><Send size={20} aria-hidden /><div><h3>Telegram</h3>
        <p>{account.telegramLinked ? 'Подключён — вход без пароля' : 'Вход через ваш Telegram-аккаунт'}</p>
        {!account.telegramLinked && (webTelegramEnabled() ? <Link href="/profile/telegram">Подключить Telegram</Link> : miniEnabled()
          ? <a href="https://t.me/roomlet_shop_bot?startapp=link">Подключить Telegram</a> : <p>Подключение пока недоступно</p>)}
        {account.telegramLinked && !account.emailConfirmed && <Link href="/profile/email">У меня уже есть аккаунт с почтой</Link>}
      </div></div>
      <div className="profile-settings-method"><Mail size={20} aria-hidden /><div><h3>Почта и пароль</h3>
        {account.emailConfirmed ? <><p>{account.email} · подтверждена</p>
          {pendingEmail&&<p>{emailState.email} · ожидает подтверждения</p>}<Link href="/profile/email">{pendingEmail?'Подтвердить новый адрес':'Изменить почту'}</Link><br/><Link href="/profile/forgot?next=/profile/settings">Настроить или изменить пароль</Link></>
          : <><p>{pendingEmail?'Ожидает подтверждения':'Не подключена'}</p><Link href="/profile/email">{pendingEmail?'Подтвердить адрес':'Подключить почту'}</Link></>}
      </div></div>
    </section>
    <section className="profile-settings-section" aria-labelledby="account-heading">
      <h2 id="account-heading">Аккаунт</h2>
      <Link href="/profile/notifications" className="profile-settings-row"><Bell size={19} aria-hidden /><span>Уведомления</span><ChevronRight size={18} aria-hidden /></Link>
      <details className="profile-settings-privacy"><summary>Конфиденциальность</summary>
        <p>Почта и телефон используются для связи с вами. Они необязательны. Рассылки включаются только с отдельного согласия в настройках уведомлений.</p>
        <p>Избранное сохраняется в этом браузере. Выход из аккаунта его не удаляет.</p>
      </details>
      <details className="profile-settings-privacy"><summary>Мой идентификатор Roomlet</summary>
        <p>Сообщите его владельцу, если вам нужен доступ к мастерской.</p><code>{account.id}</code>
        {account.telegramId && <p>Telegram ID: {account.telegramId}</p>}
      </details>
      <form action={leaveProfile}><button className="profile-settings-row profile-settings-logout" type="submit"><LogOut size={19} aria-hidden /><span>Выйти из аккаунта</span></button></form>
    </section>
  </section>;
}
