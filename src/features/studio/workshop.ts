import "server-only";
import {cache} from "react";
import {requireStaff} from "./session";

export interface Block {id:string;start_date:string;end_date:string;reason:string|null}
export interface Hours {weekday:number;minutes:number}
export const readWorkshop = cache(async () => {
  const {supabase,role} = await requireStaff();
  const [settings,hours,blocks] = await Promise.all([
    supabase.from("workshop_settings").select("timezone,currency,buffer_minutes,created_at,updated_at,telegram_support_username").eq("id",1).single(),
    supabase.from("working_hours").select("weekday,minutes").order("weekday"),
    supabase.from("blocked_periods").select("id,start_date,end_date,reason").order("start_date"),
  ]);
  if (settings.error || hours.error || blocks.error) throw new Error("Не удалось прочитать настройки мастерской.");
  // The seed creates UTC with identical timestamps. Every settings save touches updated_at, including an explicit UTC choice.
  return {role,telegramSupport:settings.data.telegram_support_username as string|null,timezone:String(settings.data.timezone), timezoneConfigured:settings.data.timezone !== "UTC" || settings.data.created_at !== settings.data.updated_at, currency:String(settings.data.currency),
    bufferMinutes:Number(settings.data.buffer_minutes),hours:hours.data as Hours[],blocks:blocks.data as Block[]};
});
export type Workshop = Awaited<ReturnType<typeof readWorkshop>>;
