"use server";

import { redirect } from "next/navigation";
import { createRoomletClient } from "@/lib/supabase/server";

export async function acceptInvitation(form: FormData) {
  const token = String(form.get("token_hash") ?? "");
  if (!/^[\w-]{24,256}$/.test(token)) redirect("/studio/invitation?error=expired");
  const supabase = await createRoomletClient();
  const { error } = await supabase.auth.verifyOtp({ type: "invite", token_hash: token });
  if (error) redirect("/studio/invitation?error=expired");
  redirect("/studio/invitation/password");
}

export async function setInvitationPassword(form: FormData) {
  const supabase = await createRoomletClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/studio/invitation?error=expired");
  const password = String(form.get("password") ?? "");
  if (password.length < 8 || password.length > 128) redirect("/studio/invitation/password?error=password");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/studio/invitation/password?error=password");
  redirect("/profile");
}
