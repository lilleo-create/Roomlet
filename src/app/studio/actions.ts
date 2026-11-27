"use server";

import { redirect } from "next/navigation";
import { beginDemo, endDemo, studioDestination } from "@/features/studio/session";

export async function enterStudio(form: FormData) {
  await beginDemo();
  redirect(studioDestination(form.get("next")));
}
export async function leaveStudio() {
  await endDemo();
  redirect("/studio/login");
}
