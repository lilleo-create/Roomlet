import "server-only";
import { cache } from "react";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { createRoomletClient } from "@/lib/supabase/server";

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
    .select("display_name, role").eq("id", user.id).single();
  if (profileError || !data || !Object.hasOwn(roleLabels, data.role)) {
    throw new Error("Не удалось получить данные профиля.");
  }
  const name: string = data.display_name.trim();
  return { id: user.id, email: user.email ?? "", name, role: data.role as AccountRole };
});
