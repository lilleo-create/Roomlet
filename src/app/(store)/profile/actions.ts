"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createRoomletClient } from "@/lib/supabase/server";
import { endSession } from "@/lib/supabase/password";
import { readAccount } from "@/features/profile/session";

export async function leaveProfile() {
  await endSession("/profile");
}

export async function updateDisplayName(form: FormData) {
  const account = await readAccount();
  if (!account) redirect("/profile/login?next=/profile/settings");
  const name = String(form.get("display_name") ?? "").trim();
  if (Array.from(name).length > 100) redirect("/profile/settings?result=invalid");

  const client = await createRoomletClient();
  const { error } = await client.from("profiles").update({ display_name: name })
    .eq("id", account.id).select("id").single();
  if (error) redirect("/profile/settings?result=error");
  revalidatePath("/profile", "layout");
  redirect("/profile/settings?result=saved");
}
