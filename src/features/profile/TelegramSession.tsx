"use client";

import Script from "next/script";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { authDestination } from "./auth-paths";

type WebApp = {initData: string; ready: () => void};
type Session = {status: string; mini: boolean; link: (accountId: string) => Promise<string>};
const TelegramContext = createContext<Session>({status:"detecting", mini:false, link:async()=>"unavailable"});
const webApp = () => (window as Window & {Telegram?:{WebApp?:WebApp}}).Telegram?.WebApp;

export function TelegramSession({children}: {children: ReactNode}) {
  const router = useRouter();
  const started = useRef(false);
  const [state, setState] = useState({status:"detecting", mini:false});
  const exchange = useCallback(async (accountId?: string) => {
    const raw = webApp()?.initData;
    if (!raw) return "outside";
    try {
      const response = await fetch("/api/telegram/session", {
        method:"POST", credentials:"same-origin", cache:"no-store", signal:AbortSignal.timeout(15000),
        headers:{"Content-Type":"text/plain;charset=UTF-8", "x-roomlet-intent":accountId?"link":"login",
          ...(accountId?{"x-roomlet-account":accountId}:{})}, body:raw,
      });
      const data = await response.json();
      const accepted = response.ok && ["signed-in","existing","linked"].includes(data.result);
      // A launch proof expires; an already established Supabase session does not expire with it.
      // Check the cookie on a separate request, including when the browser blocks its storage.
      if (accepted || !accountId && response.status === 401 && data.result === "invalid") {
        const check = await fetch("/api/telegram/session", {credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(10000)});
        if (check.ok && (await check.json()).authenticated === true) return "authenticated";
        if (accepted) return "cookies";
      }
      return typeof data.result === "string" ? data.result : "unavailable";
    } catch { return "unavailable"; }
  }, []);

  async function ready() {
    if (started.current) return;
    started.current = true;
    const app = webApp();
    app?.ready();
    if (!app?.initData) { setState({status:"web",mini:false}); return; }
    // SDK data only selects the UX. Authentication happens on the server.
    const location = new URL(window.location.href);
    const next = authDestination(location.searchParams.get("next"));
    const linking = ["/mini/link","/profile/telegram"].includes(location.pathname) ||
      location.pathname === "/profile/login" && ["/mini/link","/profile/telegram"].includes(next);
    if (linking) { setState({status:"link",mini:true}); return; }
    if (new URLSearchParams(app.initData).get("start_param") === "link") {
      setState({status:"link",mini:true}); router.replace("/mini/link"); return;
    }
    setState({status:"pending",mini:true});
    const status = await exchange();
    setState({status,mini:true});
    if (status !== "authenticated") return;
    if (location.pathname === "/mini") router.replace(location.searchParams.has("next") ? next : "/");
    else if (["/profile/login","/profile/register"].includes(location.pathname)) router.replace(next);
    router.refresh();
  }

  return <TelegramContext.Provider value={{...state,link:exchange}}>
    <Script id="roomlet-telegram-sdk" src="https://telegram.org/js/telegram-web-app.js" onReady={() => { void ready(); }}
      onError={() => setState({status:"unavailable",mini:window.self !== window.top || new URLSearchParams(window.location.hash.slice(1)).has("tgWebAppData")})} />
    {children}
  </TelegramContext.Provider>;
}

export const useTelegramSession = () => useContext(TelegramContext);

export function TelegramSessionStatus() {
  const {status} = useTelegramSession();
  const pending = ["detecting","pending","authenticated"].includes(status);
  return <p role={pending?"status":"alert"}>{pending ? "Проверяем вход…"
    : status === "web" ? "Откройте мини-приложение из Telegram."
    : status === "conflict" ? "Telegram уже связан с другим аккаунтом."
    : status === "disabled" ? "Вход из Telegram ещё не подключён."
    : status === "cookies" ? "Браузер не сохранил сеанс. Откройте Roomlet в приложении Telegram или разрешите cookies для мини-приложения."
    : "Вход не завершён. Закройте мини-приложение и откройте его снова из бота."}</p>;
}
