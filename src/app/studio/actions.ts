"use server";
import {redirect} from "next/navigation";
import {createRoomletClient} from "@/lib/supabase/server";

export async function enterStudio(form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password || email.length > 320 || password.length > 4096) redirect("/studio/login?error=credentials");
  const client = await createRoomletClient();
  const {error} = await client.auth.signInWithPassword({email,password});
  if (error) redirect("/studio/login?error=" + (error.status && error.status < 500 ? "credentials" : "connection"));
  redirect("/studio");
}

export async function leaveStudio() {
  const supabase = await createRoomletClient();
  const {error} = await supabase.auth.signOut({scope:"local"});
  if (error) throw new Error("Не удалось завершить сеанс. Повторите попытку.");
  redirect("/studio/login");
}
