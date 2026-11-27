import { CalendarClock } from "lucide-react";
import { windowLabel } from "./calendar";

export function BookingWindow({start}: {start: string | null}) {
  return <div className="bk-window" role="status">
    <CalendarClock size={20} aria-hidden="true"/>
    {start ? <div><strong>{windowLabel(start)}</strong><p>Предварительный период работы. Мастер уточнит сроки при согласовании.</p></div>
      : <p>Выберите свободную дату начала. Окно включает два рабочих дня.</p>}
  </div>;
}
