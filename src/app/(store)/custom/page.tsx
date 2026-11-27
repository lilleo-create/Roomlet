import { CustomPage } from "@/features/store/Custom";
import { isDemoCatalog } from "@/features/store/catalog-data";
import { readPublicSchedule } from "@/features/booking/public-schedule";
import { todayInStudio } from "@/features/booking/calendar";

export default async function CustomProject() {
  const schedule = await isDemoCatalog() ? await readPublicSchedule().catch(() => null) : null;
  const workshop = schedule ? { timezone: schedule.timezone, today: todayInStudio(new Date(), schedule.timezone) } : null;
  return <CustomPage workshop={workshop}/>;
}
