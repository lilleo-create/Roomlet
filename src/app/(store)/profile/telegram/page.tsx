import Link from 'next/link';
import { redirect } from 'next/navigation';
import { readAccount } from '@/features/profile/session';
import { webTelegramEnabled } from '@/lib/telegram/config.server';
import { PageHeading } from '@/components/ui';
import { TelegramLinkAction } from '@/features/profile/TelegramLinkAction';
export const metadata={title:'Привязать Telegram',robots:{index:false,follow:false}};
export default async function TelegramLink() {
  const account=await readAccount();
  if(!account) redirect('/profile/login?next=/profile/telegram');
  if(account.telegramLinked) redirect('/profile/settings');
  return <section className="store-page store-narrow profile-subpage">
    <Link href="/profile/settings" className="store-back">Настройки профиля</Link>
    <PageHeading title="Привязать Telegram" />
    <p>Подключить Telegram к аккаунту {account.email || account.name}? Существующие заказы и роль сохранятся.</p>
    <TelegramLinkAction accountId={account.id} webAvailable={webTelegramEnabled()} />
  </section>;
}
