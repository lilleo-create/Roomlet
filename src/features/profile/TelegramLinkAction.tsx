"use client";
import { Button } from "@/components/ui";
import { MiniLaunch } from "./MiniLaunch";
import { useTelegramSession } from "./TelegramSession";

export function TelegramLinkAction({accountId,webAvailable}: {accountId:string;webAvailable:boolean}) {
  const session = useTelegramSession();
  if (session.status === "detecting") return <p role="status">Проверяем способ входа…</p>;
  if (session.mini) return <MiniLaunch accountId={accountId} />;
  return webAvailable ? <form action="/api/telegram/login" method="post"><Button type="submit">Подтвердить в Telegram</Button></form>
    : <p>Привязка Telegram пока недоступна.</p>;
}
