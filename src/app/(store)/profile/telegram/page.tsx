import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Mail, Link2, ArrowLeft } from 'lucide-react';
import { readAccount } from '@/features/profile/session';
import { webTelegramEnabled } from '@/lib/telegram/config.server';
import { readLinkTicket } from '@/lib/telegram/link-ticket.server';
import { TelegramLinkAction } from '@/features/profile/TelegramLinkAction';
import { TelegramIcon } from '@/features/profile/AuthField';
import '@/features/profile/auth.css';
export const metadata = { title: 'Подключить Telegram', robots: { index: false, follow: false } };
export default async function TelegramLink({ searchParams }: { searchParams: Promise<{ confirm?: string; error?: string; reference?: string }> }) {
  const account = await readAccount();
  if (!account) redirect('/profile/login?next=/profile/telegram');
  if (account.telegramLinked) redirect('/profile/settings');
  const query = await searchParams;
  const ticket = query.confirm === 'merge' ? await readLinkTicket(account.id) : null;
  const reference = query.reference && /^[a-f0-9]{8}$/.test(query.reference) ? query.reference : null;
  const errorMessage = query.error === 'reopen' ? 'Подтверждение уже использовано. Начните подключение заново.'
    : query.error === 'storage' ? 'Не удалось сохранить подключение. Попробуйте ещё раз.'
    : 'Подключение не завершено. Ваш аккаунт сохранён. Попробуйте ещё раз.';
  return <section className="account-page">
    <div className="account-top"><Link href="/" className="store-logo" aria-label="Roomlet — главная">roomlet<span aria-hidden>.</span></Link>
      <Link href="/profile/settings" className="account-back" aria-label="Настройки профиля"><ArrowLeft size={20} aria-hidden /></Link></div>
    <div className="account-link-art" aria-hidden><span><Mail size={26} strokeWidth={1.5} /></span><Link2 size={22} strokeWidth={1.5} /><span><TelegramIcon size={26} /></span></div>
    <div className="account-layout"><header className="account-heading"><h1>Подключить Telegram</h1><p>Один аккаунт Roomlet, два способа входа.</p></header>
      <p className="account-link-copy">Входите так, как вам удобно.<br />Ваши заказы и избранное останутся с вами.</p>
      {query.confirm === 'merge' && !ticket && <p role="alert" className="account-error">Время подтверждения истекло. Подключите Telegram ещё раз.</p>}
      {query.error && <p role="alert" className="account-error">{errorMessage}{reference && <> Код обращения: {reference}.</>}</p>}
      <TelegramLinkAction accountId={account.id} webAvailable={webTelegramEnabled()} mergeRequired={Boolean(ticket)} />
    </div>
  </section>;
}
