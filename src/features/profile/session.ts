import "server-only";
import { cache } from "react";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { createRoomletClient } from "@/lib/supabase/server";
import { telegramPicture } from './contact';

export type AccountRole = "owner" | "maker" | "customer";

export const roleLabels: Record<AccountRole, string> = {
  owner: "Владелец мастерской",
  maker: "Мастер",
  customer: "Покупатель",
};

export const readAccount = cache(async () => {
  const supabase = await createRoomletClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    if (isAuthSessionMissingError(error) || error.status === 401 || error.code === "session_not_found") return null;
    throw new Error("Не удалось проверить сеанс.");
  }
  if (!user) return null;

  const { data, error: profileError } = await supabase.from("profiles")
    .select("display_name, role, contact_email, contact_phone").eq("id", user.id).single();
  if (profileError || !data || !Object.hasOwn(roleLabels, data.role)) {
    throw new Error("Не удалось получить данные профиля.");
  }
  const telegram = user.identities?.find(identity => identity.provider === "custom:roomlet-telegram");
  const telegramName = telegram?.identity_data?.name;
  const name = data.display_name.trim() || (typeof telegramName === "string" ? telegramName : "");
  return { telegramLinked: Boolean(telegram), id: user.id, email: user.email ?? "", name, role: data.role as AccountRole,
    contactEmail: data.contact_email ?? '', contactPhone: data.contact_phone ?? '',
    emailConfirmed: Boolean(user.email && user.email_confirmed_at),
    avatar: telegramPicture(telegram?.identity_data?.picture),
    telegramId: typeof telegram?.identity_data?.sub === 'string' ? telegram.identity_data.sub.replace(/^tg:/,'') : null };
});
