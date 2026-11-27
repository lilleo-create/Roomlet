"use server";

import { redirect } from "next/navigation";
import { readAccount } from "@/features/profile/session";
import { createRoomletClient } from "@/lib/supabase/server";

export async function saveNotifications(form: FormData) {
  if (!await readAccount()) redirect("/profile/login?next=/profile/notifications");
  const supabase = await createRoomletClient();
  const { error } = await supabase.rpc("save_notification_preferences", {
    p_order_updates: form.get("order_updates") === "on",
    p_marketing_opt_in: form.get("marketing_opt_in") === "on",
  });
  redirect("/profile/notifications?result=" + (error ? "error" : "saved"));
}
