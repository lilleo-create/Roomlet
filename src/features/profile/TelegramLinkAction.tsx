"use client";
import { Button } from '@/components/ui';
import { Checkbox } from '@/components/Checkbox';
import { MiniLaunch } from './MiniLaunch';
import { useTelegramSession } from './TelegramSession';
import { useActionState, useState } from 'react';
import { confirmTelegramTransfer } from './link-actions';
import { TelegramIcon } from './AuthField';

export function TelegramLinkAction({ accountId, webAvailable, mergeRequired }: { accountId: string; webAvailable: boolean; mergeRequired: boolean }) {
  const session = useTelegramSession();
  const [transfer, setTransfer] = useState(false);
  const [state, action, pending] = useActionState(confirmTelegramTransfer, {});
  if (mergeRequired) return <form action={action} className="account-form" aria-busy={pending} onReset={() => setTransfer(false)}>
    <p className="account-link-copy">Telegram подтверждён. В нём уже есть отдельный профиль Roomlet.</p>
    <Checkbox className="account-link-consent" name="allow_transfer" value="yes" required checked={transfer} onChange={event => setTransfer(event.target.checked)}>
      <strong>Объединить мои аккаунты</strong>Перенести данные существующего Telegram-профиля.
    </Checkbox>
    <p className="account-link-copy">Заказы и заявки сохранятся. Основным останется ваш аккаунт с почтой.</p>
    {state.error && <p className="account-error" role="alert">{state.error}</p>}
    <Button type="submit" disabled={!transfer || pending}>{pending ? 'Объединяем…' : 'Объединить и подключить'}</Button>
    <a className="account-text-link" href="/profile/telegram">Начать подключение заново</a>
  </form>;
  if (session.status === 'detecting') return <p role="status">Проверяем способ входа…</p>;
  return <div className="account-form">
    {session.mini ? <MiniLaunch accountId={accountId} /> : webAvailable
      ? <form action="/api/telegram/login" method="post"><Button type="submit"><TelegramIcon />Подключить Telegram</Button></form>
      : <p>Подключение Telegram пока недоступно.</p>}
    <p className="account-link-footer">Подключение выполняется один раз.</p>
  </div>;
}
