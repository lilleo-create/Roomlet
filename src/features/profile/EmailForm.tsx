"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, MailCheck, Send } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { submitEmail, type EmailState } from "./email-actions";
import { authHref, type AuthMode } from "./auth-paths";

const screens = {
  login: { title: "Вход в профиль", description: "Войдите в свой аккаунт Roomlet.", submit: "Войти", pending: "Входим…" },
  register: { title: "Создать аккаунт", description: "Начните с электронной почты и пароля.", submit: "Создать аккаунт", pending: "Создаём аккаунт…" },
  forgot: { title: "Забыли пароль?", description: "Укажите почту, которую использовали для входа.", submit: "Получить письмо", pending: "Запрашиваем письмо…" },
  confirm: { title: "Подтвердите почту", description: "Завершите регистрацию в Roomlet.", submit: "Подтвердить почту", pending: "Подтверждаем…" },
  recover: { title: "Новый пароль", description: "Придумайте новый пароль для аккаунта Roomlet.", submit: "Сохранить пароль", pending: "Сохраняем…" },
};
const initial: EmailState = {};

export function EmailForm({ mode, next, code, flowId, recovered, demo, invalidLink }: {
  mode: AuthMode; next: string; code?: string; flowId?: string; recovered: boolean; demo: boolean; invalidLink: boolean;
}) {
  const [state, action, pending] = useActionState(submitEmail, initial);
  const [visible, setVisible] = useState(false);
  const screen = screens[mode];
  const verify = mode === "confirm" || mode === "recover";
  const newPassword = mode === "register" || mode === "recover";
  const back = mode === "login" ? "/profile" : authHref(mode === "recover" ? "forgot" : "login", next);
  const backLabel = mode === "login" ? "Мой профиль" : mode === "recover" ? "Восстановление пароля" : "Ко входу";

  return <section className="account-page">
    <Link href={back} className="account-back"><ArrowLeft size={17} aria-hidden />{backLabel}</Link>
    <div className="account-layout">
      <header className="account-heading"><h1>{state.sent ? "Проверьте почту" : screen.title}</h1>
        <p>{state.sent ? mode === "forgot" ? "Если аккаунт с таким адресом существует, придут инструкции для смены пароля." : "Откройте письмо Roomlet и подтвердите адрес, чтобы продолжить." : screen.description}</p>
      </header>
      {state.sent ? <div className="account-receipt" role="status"><MailCheck size={38} strokeWidth={1.35} aria-hidden />
        {demo && <p>В демоверсии письмо с кодом доступно в консоли локального запуска.</p>}
        <Link className="store-primary-link" href={authHref(mode === "forgot" ? "recover" : "confirm", next)}>Ввести код из письма <ArrowRight size={18} aria-hidden /></Link>
        <Link className="account-text-link" href={authHref("login", next)}>Вернуться ко входу</Link>
      </div> : <div className="account-body">
        {(mode === "login" || mode === "register") && <div className="account-method">
          <button className="account-telegram" type="button" disabled aria-describedby="telegram-availability">
            <Send size={20} aria-hidden /><span>{mode === "login" ? "Войти через Telegram" : "Продолжить с Telegram"}</span></button>
          <p id="telegram-availability">Вход через Telegram пока недоступен.</p>
          <div className="account-divider"><span>По электронной почте</span></div>
        </div>}
        {recovered && <p className="account-notice" role="status">Пароль изменён. Войдите с новым паролем.</p>}
        {invalidLink && <p className="account-error" role="alert">Ссылка недействительна или истекла. Запросите новое письмо.</p>}
        <form className="account-form" action={action} aria-busy={pending}>
          <input type="hidden" name="intent" value={mode} />
          <input type="hidden" name="next" value={next} />
          {verify && code && <input type="hidden" name="code" value={code} />}
          {verify && code && flowId && <input type="hidden" name="sb_flow_id" value={flowId} />}
          {(!verify || !code) && <Input label="Электронная почта" name="email" placeholder="name@example.com" type="email"
            autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} defaultValue={state.email} />}
          {verify && !code && <Input label="Код из письма" name="otp" type="text" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required />}
          {(mode === "login" || newPassword) && <div className="account-password">
            <Input label={mode === "recover" ? "Новый пароль" : "Пароль"} name="password"
              type={visible ? "text" : "password"} autoComplete={newPassword ? "new-password" : "current-password"} required
              minLength={newPassword ? 8 : undefined} maxLength={newPassword ? 128 : 4096} hint={newPassword ? "От 8 символов" : undefined} />
            <button className="account-eye" type="button" aria-label={visible ? "Скрыть пароль" : "Показать пароль"} aria-pressed={visible}
              onClick={() => setVisible(previous => !previous)}>{visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}</button>
          </div>}
          {mode === "register" && <details className="account-name"><summary>Добавить имя</summary><Input label="Имя в профиле" name="display_name" autoComplete="given-name" maxLength={100} defaultValue={state.name} /></details>}
          {mode === "login" && <Link className="account-forgot" href={authHref("forgot", next)}>Забыли пароль?</Link>}
          {state.error && <p className="account-error" role="alert">{state.error}</p>}
          <Button type="submit" disabled={pending}>{pending ? screen.pending : screen.submit} <ArrowRight size={17} aria-hidden /></Button>
        </form>
        {(mode === "login" || mode === "register") && <p className="account-switch">{mode === "login" ? "Впервые здесь?" : "Уже есть аккаунт?"}{" "}
          <Link href={authHref(mode === "login" ? "register" : "login", next)}>{mode === "login" ? "Создать аккаунт" : "Войти"}</Link></p>}
        {verify && <Link className="account-text-link" href={authHref(mode === "recover" ? "forgot" : "login", next)}>{mode === "recover" ? "Запросить новое письмо" : "Вернуться ко входу"}</Link>}
      </div>}
    </div>
  </section>;
}
