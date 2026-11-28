"use client";

import Script from "next/script";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLaunchReady } from "@/features/launch/LaunchProvider";
import { Button } from "@/components/ui";
import { authDestination } from "./auth-paths";

type WebApp = { initData:string; ready:()=>void };
function webApp() {
  return (window as Window & {Telegram?:{WebApp?:WebApp}}).Telegram?.WebApp;
}

export function MiniLaunch({accountId, next = "/"}: {accountId?:string;next?:string}) {
  const router = useRouter();
  const launchReady = useLaunchReady();
  const [status,setStatus] = useState("loading");
  const started = useRef(false);
  useEffect(() => {
    if (status !== "loading" && status !== "pending") launchReady?.();
  }, [status, launchReady]);
  async function exchange() {
    if (started.current) return;
    const raw = webApp()?.initData;
    if (!raw) { setStatus("outside"); return; }
    started.current = true;
    setStatus("pending");
    try {
      const headers:Record<string,string> = {"Content-Type":"text/plain;charset=UTF-8","x-roomlet-intent":accountId?"link":"login"};
      if (accountId) headers["x-roomlet-account"] = accountId;
      const response = await fetch("/api/telegram/session",{method:"POST",headers,body:raw,credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(15000)});
      const {result} = await response.json();
      if (response.ok && ["linked","existing","signed-in"].includes(result)) {
        router.replace(accountId?"/profile/settings":authDestination(next));
      } else setStatus(result);
    } catch { setStatus("unavailable"); }
  }
  function ready() {
    const app = webApp();
    app?.ready();
    if (!app?.initData) { setStatus("outside"); return; }
    // A start parameter can only select a screen. Identity is verified by the server.
    if (!accountId && new URLSearchParams(app.initData).get("start_param") === "link") {
      router.replace("/mini/link"); return;
    }
    if (accountId) setStatus("confirm");
    else void exchange();
  }
  const pending = status === "pending" || status === "loading";
  return <>
    <Script id="roomlet-telegram-sdk" src="https://telegram.org/js/telegram-web-app.js" onReady={ready} onError={()=>setStatus("unavailable")} />
    {status === "confirm" ? <Button type="button" onClick={exchange}>Подтвердить привязку</Button>
      : status === "reauth" ? <Link className="store-back" href="/profile/login?next=/mini/link">Подтвердить вход по почте и паролю</Link>
      : <p role={pending?"status":"alert"}>{pending ? "Проверяем вход…"
        : status === "outside" ? "Откройте мини-приложение из Telegram."
        : status === "conflict" ? "Telegram уже связан с другим аккаунтом."
        : "Вход не завершён. Закройте мини-приложение и откройте его снова из бота."}</p>}
  </>;
}
