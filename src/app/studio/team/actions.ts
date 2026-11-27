"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/features/studio/session";
import { sendTeamInvite } from "@/features/studio/TeamInvite";

function message(code: string): never {
  redirect("/studio/team?notice=" + code);
}

function emailFrom(form: FormData) {
  const value = String(form.get("email") ?? "").trim();
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) message("email");
  return value;
}

export async function inviteMember(form: FormData) {
  await requireOwner();
  const email = emailFrom(form);
  let result: Awaited<ReturnType<typeof sendTeamInvite>>;
  try {
    result = await sendTeamInvite(email);
  } catch {
    message("mail-error");
  }
  message(result);
}

export async function grantMaker(form: FormData) {
  const { supabase } = await requireOwner();
  const email = emailFrom(form);
  const { error } = await supabase.rpc("roomlet_grant_maker", { p_email: email });
  if (error?.code === "P0002") message("missing");
  if (error) message("grant-error");
  revalidatePath("/studio/team");
  message("granted");
}

export async function revokeMaker(form: FormData) {
  const { supabase } = await requireOwner();
  const id = String(form.get("id") ?? "");
  if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) message("revoke-error");
  const { error } = await supabase.rpc("roomlet_revoke_maker", { p_user_id: id });
  if (error) message("revoke-error");
  revalidatePath("/studio/team");
  message("revoked");
}
