"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAccountStaff } from "@/features/studio/session";
import { localDemoEnabled } from "@/lib/supabase/config";
import { showcaseClient } from "@/lib/supabase/showcase";

export async function enterShowcase() {
  await requireAccountStaff("demo-login");
  if (!localDemoEnabled()) {
    // Initialize first, so a cold start failure cannot strand the visitor in demo mode.
    await showcaseClient();
    (await cookies()).set("roomlet-environment","demo",{httpOnly:true,secure:process.env.ROOMLET_SITE_URL?.startsWith("https://") ?? false,sameSite:"lax",path:"/"});
  }
  redirect("/");
}
export async function leaveShowcase() {
  (await cookies()).delete("roomlet-environment");
  redirect("/studio");
}
