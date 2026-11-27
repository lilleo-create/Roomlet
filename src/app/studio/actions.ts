"use server";
import { endSession, passwordLogin } from "@/lib/supabase/password";

export async function enterStudio(form: FormData) {
  await passwordLogin(form, "/studio");
}

export async function leaveStudio() {
  await endSession("/studio/login");
}
