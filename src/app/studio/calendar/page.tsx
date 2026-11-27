import { requireDemo } from "@/features/studio/session";
import { todayInStudio } from "@/features/booking/calendar";
import { calendarFixture } from "@/features/studio/data";
import { StudioCalendar } from "@/features/studio/StudioCalendar";
import { StudioShell } from "@/features/studio/Shell";
export default async function CalendarPage() {
  await requireDemo("calendar");
  const today = todayInStudio();
  return <StudioShell active="calendar"><p className="rs-cap">Производство</p><StudioCalendar today={today} fixture={calendarFixture(today)}/></StudioShell>;
}
