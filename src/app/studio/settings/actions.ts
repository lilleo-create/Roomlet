"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requireStaff} from "@/features/studio/session";
import {validDate} from "@/features/booking/calendar";

function finish(code:"saved"|"invalid"|"failed"):never {
  if (code === "saved") revalidatePath("/studio","layout");
  redirect("/studio/settings?result=" + code);
}
export async function saveSettings(form:FormData) {
  const {supabase} = await requireStaff();
  const timezone = String(form.get("timezone") ?? "");
  const currency = String(form.get("currency") ?? "");
  const buffer = Number(form.get("buffer_minutes"));
  try { new Intl.DateTimeFormat("ru",{timeZone:timezone}); } catch { finish("invalid"); }
  if (!Intl.supportedValuesOf("currency").includes(currency) || !Number.isInteger(buffer) || buffer < 0 || buffer > 1440) finish("invalid");
  const hours = Array.from({length:7},(_,i)=>({weekday:i+1,minutes:Math.round(Number(form.get("day-"+(i+1)))*60)}));
  if (hours.some(h=>!Number.isFinite(h.minutes)|| h.minutes < 0 || h.minutes > 1440)) finish("invalid");
  const {error} = await supabase.rpc("save_workshop_settings",{p_timezone:timezone,p_currency:currency,p_buffer_minutes:buffer,p_hours:hours});
  finish(error ? "failed" : "saved");
}
export async function addBlock(form:FormData) {
  const {supabase} = await requireStaff();
  const start_date=String(form.get("start")??""), end_date=String(form.get("end")??"");
  const reason=String(form.get("reason")??"").trim();
  if (!validDate(start_date)||!validDate(end_date)||end_date<start_date||reason.length>200) finish("invalid");
  const {error}=await supabase.from("blocked_periods").insert({start_date,end_date,reason});
  finish(error?"failed":"saved");
}
export async function removeBlock(form:FormData) {
  const {supabase} = await requireStaff();
  const id=String(form.get("id")??"");
  if (!/^[\da-f-]{36}$/i.test(id)) finish("invalid");
  const {error}=await supabase.from("blocked_periods").delete().eq("id",id).select("id").single();
  finish(error?"failed":"saved");
}
