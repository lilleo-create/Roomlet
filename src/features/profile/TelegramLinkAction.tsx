"use client";
import { Button } from "@/components/ui";
import { MiniLaunch } from "./MiniLaunch";
import { useTelegramSession } from "./TelegramSession";
import { useState } from 'react';

export function TelegramLinkAction({accountId,webAvailable}: {accountId:string;webAvailable:boolean}) {
  const session = useTelegramSession();
  const [transfer,setTransfer] = useState(false);
  if (session.status === "detecting") return <p role="status">Проверяем способ входа…</p>;
  return <div className="store-form">
    <label className="profile-link-consent"><input type="checkbox" checked={transfer} onChange={event => setTransfer(event.target.checked)} />
      <span>Если в Telegram уже есть отдельный аккаунт покупателя, перенести его заказы и заявки в этот аккаунт. Мои сохранённые контактные данные останутся приоритетными.</span></label>
    <p>Привязка потребует входа по почте и паролю, затем подтверждения в Telegram. Избранное в этом браузере сохранится.</p>
    {session.mini ? <MiniLaunch accountId={accountId} allowTransfer={transfer} /> : webAvailable
      ? <form action="/api/telegram/login" method="post"><input type="hidden" name="allow_transfer" value={transfer?'yes':'no'} /><Button type="submit">Подтвердить в Telegram</Button></form>
      : <p>Привязка Telegram пока недоступна.</p>}
  </div>;
}
