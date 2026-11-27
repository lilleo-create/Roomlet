import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createRoomletClient } from "@/lib/supabase/server";

export type StudioSection = "today" | "calendar" | "orders" | "products" | "settings" | "team";

export const requireAccountStaff = cache(async (denied: "login" | "not-found" | "demo-login" = "login") => {
  const supabase = await createRoomletClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    if (denied === "not-found") notFound();
    redirect(denied === "demo-login" ? "/studio/login?next=demo" : "/studio/login");
  }
  const profile = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile.error) throw new Error("Не удалось проверить права мастерской.");
  const role = profile.data?.role;
  if (role !== "maker" && role !== "owner") {
    if (denied === "not-found") notFound();
    redirect("/studio/login?error=access");
  }
  return { supabase, user, role: role as "owner" | "maker" };
});

// Compatibility for already open forms. Hosted data always uses the account's Supabase.
export const wantsShowcase = async () => false;
export const requireStaff = cache(async (denied: "login" | "not-found" | "demo-login" = "login") =>
  ({...await requireAccountStaff(denied), showcase:false}));

export const requireOwner = cache(async () => {
  const session = await requireStaff("not-found");
  if (session.showcase || session.role !== "owner") notFound();
  return session;
});
