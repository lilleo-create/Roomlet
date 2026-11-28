"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createRoomletClient } from "@/lib/supabase/server";
import { endSession } from "@/lib/supabase/password";
import { readAccount } from "@/features/profile/session";
import { profileContact } from '@/features/profile/contact';

export type ProfileSaveState = { error?: string; saved?: { name: string; email: string; phone: string } };
export async function saveProfile(_previous: ProfileSaveState, form: FormData): Promise<ProfileSaveState> {
  const account = await readAccount();
  if (!account) return { error: 'Войдите снова, чтобы сохранить изменения.' };
  const parsed = profileContact(form);
  if (!parsed.value) return { error: parsed.error };
  const client = await createRoomletClient();
  const { data, error } = await client.from('profiles').update(parsed.value).eq('id',account.id).select('id').single();
  if (error || !data) return { error: 'Не удалось сохранить изменения. Попробуйте ещё раз.' };
  revalidatePath('/profile','layout');
  return { saved: { name: parsed.value.display_name, email: parsed.value.contact_email ?? '', phone: parsed.value.contact_phone ?? '' } };
}

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
