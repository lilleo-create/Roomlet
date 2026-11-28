"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLaunchReady } from "@/features/launch/LaunchProvider";
import { Button } from "@/components/ui";
import { TelegramSessionStatus, useTelegramSession } from "./TelegramSession";

export function MiniLaunch({accountId}: {accountId?:string}) {
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
    const status = await session.link(accountId);
    setResult(status);
    if (status === "authenticated") { router.replace("/profile/settings?telegram=linked"); router.refresh(); }
  }
  if (!accountId) return <TelegramSessionStatus />;
  if (result === "reauth") return <Link className="store-back" href="/profile/login?next=/mini/link">Подтвердить вход по почте и паролю</Link>;
  return <>
    <Button type="button" disabled={!session.mini || result === "pending"} onClick={link}>Подтвердить привязку</Button>
    {result && !["pending","authenticated"].includes(result) && <p role="alert">{result === "conflict"
      ? "Этот Telegram уже связан с другим аккаунтом. Автоматическое объединение отключено."
      : "Привязка не завершена. Откройте мини-приложение снова и повторите попытку."}</p>}
  </>;
}
