"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLaunchReady } from "@/features/launch/LaunchProvider";
import { Button } from "@/components/ui";
import { TelegramSessionStatus, useTelegramSession } from "./TelegramSession";

export function MiniLaunch({accountId,allowTransfer=false}: {accountId?:string;allowTransfer?:boolean}) {
  const session = useTelegramSession();
  const launchReady = useLaunchReady();
  const router = useRouter();
  const [result,setResult] = useState("");
  useEffect(() => {
    if (!["detecting","pending","authenticated"].includes(session.status)) launchReady?.();
  }, [session.status,launchReady]);
  async function link() {
    if (!accountId || result === "pending") return;
    setResult("pending");
    const status = await session.link(accountId,allowTransfer);
    setResult(status);
    if (status === "authenticated") { router.replace("/profile/settings?telegram=linked"); router.refresh(); }
    if (status === "merge-required") { router.replace('/profile/telegram?confirm=merge'); router.refresh(); }
  }
  if (!accountId) return <TelegramSessionStatus />;
  if (result === "reauth") return <Link className="store-back" href="/profile/login?next=/mini/link">Подтвердить вход по почте и паролю</Link>;
  return <>
    <Button type="button" disabled={!session.mini || result === "pending"} onClick={link}>Подтвердить привязку</Button>
    {result && !["pending","authenticated","merge-required"].includes(result) && <p role="alert">{result === 'reopen'
      ? 'Этот запуск уже использован для входа. Откройте подключение заново — аккаунт с почтой сохранён.' : result === "conflict"
      ? "Telegram связан с другим аккаунтом. Для переноса подтвердите объединение при привязке."
      : "Привязка не завершена. Откройте мини-приложение снова и повторите попытку."}</p>}
    {result === 'reopen' && <a href="https://t.me/roomlet_shop_bot?startapp=link">Открыть привязку заново в Telegram</a>}
  </>;
}
