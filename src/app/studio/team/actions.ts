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
  const id = String(form.get('id') ?? '');
  if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id) || form.get('confirmed') !== 'yes') message('grant-error');
  const { error } = await supabase.rpc("roomlet_grant_maker_by_id", { p_user_id: id });
  if (error?.code === "P0002") message("missing");
  if (error) message("grant-error");
  revalidatePath("/studio/team");
  message("granted");
}

export type TeamAccount = {user_id:string;email:string|null;display_name:string;member_role:string;telegram_id:string|null;telegram_username:string|null};
export type TeamLookup = {error?:string;accounts?:TeamAccount[]};
export async function findTeamAccount(_previous:TeamLookup, form:FormData):Promise<TeamLookup> {
  const {supabase} = await requireOwner();
  const identifier = String(form.get('identifier') ?? '').trim();
  if (!identifier || identifier.length > 254) return {error:'Укажите Roomlet ID, Telegram ID или подтверждённую почту.'};
  const {data,error} = await supabase.rpc('roomlet_find_team_account',{p_identifier:identifier});
  if (error) return {error:'Не удалось найти участника. Попробуйте ещё раз.'};
  if (!data?.length) return {error:'Участник не найден. Попросите его скопировать идентификатор из настроек профиля.'};
  return {accounts:data};
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
