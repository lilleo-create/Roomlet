"use client";

import { useActionState, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, MailCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { AuthField as Input, TelegramIcon } from './AuthField';
import { Checkbox } from '@/components/Checkbox';
import type { RegistrationDocuments } from './registration-documents';
import { submitEmail, type EmailState } from "./email-actions";
import { authHref, type AuthMode } from "./auth-paths";
import { TelegramSessionStatus, useTelegramSession } from "./TelegramSession";

const screens = {
  login: { title: "С возвращением.", description: "Войдите, чтобы продолжить.", submit: "Войти", pending: "Входим…" },
  register: { title: "Ваш маленький мир.", description: "Создайте аккаунт, чтобы сохранять миниатюры и следить за заказами.", submit: "Создать аккаунт", pending: "Создаём аккаунт…" },
  forgot: { title: "Забыли пароль?", description: "Укажите почту, которую использовали для входа.", submit: "Получить письмо", pending: "Запрашиваем письмо…" },
  confirm: { title: "Подтвердите почту", description: "Завершите регистрацию в Roomlet.", submit: "Подтвердить почту", pending: "Подтверждаем…" },
  recover: { title: "Новый пароль", description: "Придумайте новый пароль для аккаунта Roomlet.", submit: "Сохранить пароль", pending: "Сохраняем…" },
};
const initial: EmailState = {};

function subscribeHash(listener: () => void) {
  window.addEventListener("hashchange",listener);
  return () => window.removeEventListener("hashchange",listener);
}
function hasMailError() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return params.has("error") || params.has("error_code");
}

export function EmailForm({ mode, next, code, localProof, flowId, recovered, demo, invalidLink, miniAvailable, telegramError, documents,disconnected }: {
  mode: AuthMode; next: string; code?: string; localProof?: string; flowId?: string; recovered: boolean; demo: boolean; invalidLink: boolean; miniAvailable: boolean; telegramError?:boolean;
  documents: RegistrationDocuments | null;
  disconnected?:'email'|'telegram';
}) {
  const [state, action, pending] = useActionState(submitEmail, initial);
  const telegram = useTelegramSession();
  const expiredFragment = useSyncExternalStore(subscribeHash, hasMailError, () => false);
  const [visible, setVisible] = useState(false);
  const [valid, setValid] = useState(false);
  const [remaining,setRemaining] = useState(0);
  useEffect(() => {
    if (!state.retryAt) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((state.retryAt! - Date.now()) / 1000)));
    const timer = window.setInterval(tick, 250);
    tick();
    return () => window.clearInterval(timer);
  }, [state.retryAt]);
  const screen = screens[mode];
  const requestConfirmation = mode === "confirm" && !code && !demo;
  const verify = mode === "confirm" || mode === "recover";
  const hasLink = Boolean(code || localProof);
  const newPassword = mode === "register" || mode === "recover";
  const back = mode === "login" ? "/profile" : authHref(mode === "recover" ? "forgot" : "login", next);
  const backLabel = mode === "login" ? "Мой профиль" : mode === "recover" ? "Восстановление пароля" : "Ко входу";
  const linking = ["/mini/link","/profile/telegram"].includes(next);
  if(telegram.mini && disconnected==='email') return <section className="account-page">
    <h1>Почта отключена</h1><p>Ваш профиль сохранён. Закройте Roomlet и откройте его снова из бота, чтобы войти через Telegram.</p>
    <a className="account-text-link" href="https://t.me/roomlet_shop_bot">Открыть бота Roomlet</a>
  </section>;
  if (telegram.mini && !linking && disconnected!=='telegram' && telegram.status!=='detached' && (mode === "login" || mode === "register"))
    return <section className="account-page"><TelegramSessionStatus /></section>;

  return <section className="account-page">
    <div className="account-top"><Link href="/" className="store-logo" aria-label="Roomlet — главная">roomlet<span aria-hidden>.</span></Link>
      <Link href={back} className="account-back" aria-label={backLabel}><ArrowLeft size={20} aria-hidden /></Link></div>
    <div className="account-layout">
      <header className="account-heading"><h1>{state.sent ? "Проверьте почту" : screen.title}</h1>
        <p>{state.sent ? mode === "forgot" ? "Если аккаунт с таким адресом существует, придут инструкции для смены пароля." : "Откройте ссылку из письма Supabase в этом браузере, чтобы подтвердить адрес." : screen.description}</p>
      </header>
      {state.sent ? <div className="account-receipt" role="status"><MailCheck size={38} strokeWidth={1.35} aria-hidden />
        {demo && <p>В демоверсии письмо с кодом доступно в консоли локального запуска.</p>}
        {demo && <Link className="account-text-link" href={authHref(mode === "forgot" ? "recover" : "confirm", next)}>Ввести код из локального письма</Link>}
        <form action={action}>
          <input type="hidden" name="intent" value={mode === "forgot" ? "forgot" : "resend"} />
          <input type="hidden" name="email" value={state.email} />
          <input type="hidden" name="next" value={next} />
          <Button type="submit" disabled={pending || remaining > 0}>{remaining ? `Повторить через ${remaining} с` : "Отправить письмо ещё раз"}</Button>
        </form>
        {state.error && <p role="alert" className="account-error">{state.error}</p>}
        <Link className="account-text-link" href={authHref("login", next)}>Вернуться ко входу</Link>
      </div> : <div className="account-body">
        {(mode === "login" || mode === "register") && telegram.status === "web" && !linking && <div className="account-method">
          {miniAvailable ? <a className="account-telegram" href={"/api/telegram/login?next="+encodeURIComponent(next)}>
            <TelegramIcon /><span>Продолжить через Telegram</span></a> : <>
          <button className="account-telegram" type="button" disabled aria-describedby="telegram-availability">
            <TelegramIcon /><span>Продолжить через Telegram</span></button>
          <p id="telegram-availability">Вход через Telegram пока недоступен.</p></>}
          <div className="account-divider"><span>По электронной почте</span></div>
        </div>}
        {telegramError && <p className="account-error" role="alert">Вход через Telegram не завершён. Попробуйте ещё раз или войдите по почте.</p>}
        {recovered && <p className="account-notice" role="status">Пароль изменён. Войдите с новым паролем.</p>}
        {(disconnected || telegram.status==='detached') && <p className="account-notice" role="status">{disconnected==='email'?'Почта отключена. Войдите через Telegram.':'Telegram отключён. Войдите с почтой и паролем.'} Ваш профиль сохранён.</p>}
        {(invalidLink || expiredFragment) && <p className="account-error" role="alert">Ссылка недействительна или истекла. Запросите новое письмо.</p>}
        {mode === "recover" && !code && !demo ? <p className="account-notice">Откройте ссылку восстановления из письма в том же браузере.</p> : <form className="account-form" action={action} aria-busy={pending}
          onInput={event => setValid(event.currentTarget.checkValidity())} onChange={event => setValid(event.currentTarget.checkValidity())} onReset={() => setValid(false)}>
          <input type="hidden" name="intent" value={requestConfirmation ? "resend" : mode} />
          <input type="hidden" name="next" value={next} />
          {verify && localProof && <input type="hidden" name="local_proof" value={localProof} />}
          {verify && code && <input type="hidden" name="code" value={code} />}
          {verify && code && flowId && <input type="hidden" name="sb_flow_id" value={flowId} />}
          {mode === 'register' && <Input label="Ваше имя" name="display_name" placeholder="Как к вам обращаться?" autoComplete="given-name" required maxLength={100} defaultValue={state.name} error={state.fieldErrors?.display_name} />}
          {(!verify || !hasLink) && <Input label="Электронная почта" name="email" placeholder="name@example.com" type="email" error={state.fieldErrors?.email}
            autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} defaultValue={state.email} />}
          {verify && !hasLink && demo && <Input label="Код из письма" name="otp" type="text" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required />}
          {(mode === "login" || newPassword) && <div className="account-password">
            <Input label={mode === "recover" ? "Новый пароль" : "Пароль"} name="password" error={state.fieldErrors?.password}
              accessory={mode === 'login' ? <Link className="account-forgot" href={authHref('forgot', next)}>Забыли пароль?</Link> : undefined}
              type={visible ? "text" : "password"} autoComplete={newPassword ? "new-password" : "current-password"} required
              minLength={newPassword ? 8 : undefined} maxLength={newPassword ? 128 : 4096} hint={newPassword ? "От 8 символов" : undefined} />
            <button className="account-eye" type="button" aria-label={visible ? "Скрыть пароль" : "Показать пароль"} aria-pressed={visible}
              onClick={() => setVisible(previous => !previous)}>{visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}</button>
          </div>}
          {mode === 'register' && documents && <>
            <input type="hidden" name="privacy_version" value={documents.privacy.version} />
            <input type="hidden" name="consent_version" value={documents.consent.version} />
            <Checkbox name="registration_consent" value="yes" required>Даю <a href={documents.consent.url} target="_blank" rel="noopener noreferrer">согласие на обработку персональных данных</a> и принимаю <a href={documents.privacy.url} target="_blank" rel="noopener noreferrer">политику конфиденциальности</a>.</Checkbox>
          </>}
          {state.error && <p className="account-error" role="alert">{state.error}</p>}
          <Button type="submit" disabled={pending || mode === 'register' && !valid}>{requestConfirmation ? "Запросить новое письмо" : pending ? screen.pending : screen.submit} <ArrowRight size={17} aria-hidden /></Button>
        </form>}
        {(mode === "login" || mode === "register") && <p className="account-switch">{mode === "login" ? "Впервые здесь?" : "Уже есть аккаунт?"}{" "}
          <Link href={authHref(mode === "login" ? "register" : "login", next)}>{mode === "login" ? "Создать аккаунт" : "Войти"}</Link></p>}
        {(mode === "login" || mode === "confirm" && (code || invalidLink)) && <Link className="account-text-link" href={authHref("confirm", next)}>Запросить письмо подтверждения</Link>}
        {verify && <Link className="account-text-link" href={authHref(mode === "recover" ? "forgot" : "login", next)}>{mode === "recover" ? "Запросить новое письмо" : "Вернуться ко входу"}</Link>}
      </div>}
    </div>
  </section>;
}
