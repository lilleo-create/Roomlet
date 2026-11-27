"use server";

import type { AuthError, User } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { localDemoEnabled } from "@/lib/supabase/config";
import { createRoomletClient } from "@/lib/supabase/server";
import { authDestination, authHref, authMailOrigin } from "./auth-paths";

export type EmailState = { error?: string; sent?: boolean; email?: string; name?: string };
type Client = Awaited<ReturnType<typeof createRoomletClient>>;

const textField = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

function authMessage(error: AuthError) {
  if (error.status === 429) return "Слишком много попыток. Попробуйте немного позже.";
  if (error.code === "email_not_confirmed") return "Подтвердите почту по ссылке из письма.";
  if (error.code === "weak_password") return "Этот пароль слишком простой. Придумайте более надёжный.";
  return error.status && error.status < 500 ? "Проверьте почту и пароль или восстановите доступ." : "Не удалось связаться с сервисом. Попробуйте ещё раз.";
}

async function saveSignupName(client: Client, user: User) {
  const name: unknown = user.user_metadata?.display_name;
  if (typeof name !== "string" || !name.trim() || Array.from(name).length > 100) return;
  const { error } = await client.from("profiles").update({ display_name: name.trim() }).eq("id", user.id).eq("display_name", "");
  if (error) redirect("/profile/settings?result=error");
}

async function mailCallback(mode: "confirm" | "recover", next: string) {
  const host = (await headers()).get("host");
  const origin = authMailOrigin(localDemoEnabled() ? undefined : process.env.ROOMLET_SITE_URL, host);
  return origin ? new URL(authHref(mode, next), origin).href : null;
}

export async function submitEmail(_previous: EmailState, form: FormData): Promise<EmailState> {
  const mode = textField(form, "intent");
  const email = textField(form, "email").trim();
  const password = textField(form, "password");
  const name = textField(form, "display_name").trim();
  const code = textField(form, "code");
  const token = textField(form, "otp").trim();
  const flowId = textField(form, "sb_flow_id");
  const next = authDestination(textField(form, "next"));
  const fields = { email: email.slice(0, 254), name: name.slice(0, 100) };
  if (!["register","login","forgot","confirm","recover"].includes(mode)) return { error: "Действие недоступно." };
  if (!(code && (mode === "confirm" || mode === "recover")) && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return { ...fields, error: "Укажите корректный адрес почты." };
  }
  if (mode === "register" || mode === "recover") {
    if (password.length < 8 || password.length > 128) return { ...fields, error: "Используйте пароль длиной от 8 до 128 символов." };
    if (mode === "register" && Array.from(name).length > 100) return { ...fields, error: "Сократите имя до 100 символов." };
  }

  const client = await createRoomletClient(mode === "forgot" || mode === "recover" ? "recovery" : "account");
  if (mode === "login") {
    if (!password || password.length > 4096) return { ...fields, error: "Введите пароль." };
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { ...fields, error: authMessage(error) };
    redirect(next);
  }

  if (mode === "register" || mode === "forgot") {
    const callback = await mailCallback(mode === "register" ? "confirm" : "recover", next);
    if (!callback) return { ...fields, error: "Для писем ещё не настроен адрес магазина. Попробуйте позже." };
    if (mode === "forgot") {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: callback });
      if (error && error.code !== "user_not_found") return { ...fields, error: authMessage(error) };
      return { sent: true };
    }
    const { data, error } = await client.auth.signUp({ email, password, options: {
      emailRedirectTo: callback, data: name ? { display_name: name } : {},
    } });
    if (error) {
      if (error.code === "user_already_exists" || error.code === "email_exists") return { ...fields, error: "Не удалось зарегистрироваться. Попробуйте войти или восстановить пароль." };
      return { ...fields, error: authMessage(error) };
    }
    if (!data.session || !data.user) return { sent: true };
    await saveSignupName(client, data.user);
    redirect(next);
  }

  // A mail link uses the PKCE verifier from the initiating browser. A typed email
  // code is verified by Auth for the specific signup or recovery operation.
  if (code ? !/^[\w.-]{8,1024}$/.test(code) : !/^\d{6,10}$/.test(token)) return { ...fields, error: "Проверьте код из письма." };
  const result = code ? await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined) : await client.auth.verifyOtp({
    email, token, type: mode === "recover" ? "recovery" : "signup",
  });
  if (result.error || !result.data?.user || !result.data.session) return { ...fields, error: "Код истёк или ссылка открыта в другом браузере. Запросите новое письмо." };
  if (mode === "recover") {
    if (code && (!("redirectType" in result.data) || result.data.redirectType !== "recovery")) {
      await client.auth.signOut({ scope: "local" });
      return { ...fields, error: "Для смены пароля нужна ссылка из письма о восстановлении." };
    }
    const { error } = await client.auth.updateUser({ password });
    await client.auth.signOut({ scope: "local" });
    if (error) return { ...fields, error: "Не удалось изменить пароль. Запросите новое письмо и выберите другой пароль." };
    const target = new URL(authHref("login", next), "https://roomlet.invalid");
    target.searchParams.set("success", "recovered");
    redirect(target.pathname + target.search);
  }
  await saveSignupName(client, result.data.user);
  redirect(next);
}
