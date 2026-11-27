import "server-only";
import { createCatalogClient } from "@/lib/supabase/public";
import { validDate, type PublicDay } from "./calendar";

export async function readPublicSchedule(): Promise<{ timezone: string; days: PublicDay[] }> {
  const client = await createCatalogClient();
  const { data, error } = await client.rpc("roomlet_booking_calendar");
  if (error || !data || typeof data.timezone !== "string" || !Array.isArray(data.days)) {
    throw new Error("Не удалось загрузить расписание мастерской.");
  }
  new Intl.DateTimeFormat("ru-RU", { timeZone: data.timezone });
  const days = data.days.map((entry: PublicDay) => {
    if (!entry || !validDate(entry.day) || !Number.isInteger(entry.available_minutes)) {
      throw new Error("Некорректный день в расписании мастерской.");
    }
    return { day: entry.day, available_minutes: entry.available_minutes };
  });
  return { timezone: data.timezone, days };
}
