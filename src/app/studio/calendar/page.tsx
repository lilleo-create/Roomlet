import {todayInStudio} from "@/features/booking/calendar";
import {StudioCalendar} from "@/features/studio/StudioCalendar";
import {readWorkshop} from "@/features/studio/workshop";
import {StudioShell} from "@/features/studio/Shell";
export default async function CalendarPage() {
  const workshop=await readWorkshop();
  return <StudioShell active="calendar"><p className="rs-cap">Производство</p><StudioCalendar today={todayInStudio(new Date(),workshop.timezone)} workshop={workshop}/></StudioShell>;
}
