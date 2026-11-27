import { createCatalogClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const { data, error } = await createCatalogClient().rpc("roomlet_availability");
    if (error) throw error;
    return Response.json({ days: (data ?? []).map((day: { day: string; available_minutes: number }) => ({
      day: day.day, available_minutes: day.available_minutes,
    })) }, { headers });
  } catch {
    return Response.json({ error: "Расписание сейчас недоступно." }, { status: 503, headers });
  }
}
