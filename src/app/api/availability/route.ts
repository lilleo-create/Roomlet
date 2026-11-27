import { readPublicSchedule } from "@/features/booking/public-schedule";

export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    return Response.json(await readPublicSchedule(), { headers });
  } catch {
    return Response.json({ error: "Расписание сейчас недоступно." }, { status: 503, headers });
  }
}
