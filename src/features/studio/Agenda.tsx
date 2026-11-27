import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { StudioTask } from "./data";

export function Agenda({tasks}: {tasks: StudioTask[]}) {
  if (!tasks.length) return <p className="rs-muted rs-empty">На этот день задач нет.</p>;
  return <ol className="rs-agenda">{tasks.map((task) =>
    <li key={task.time}>
      <time>{task.time}</time>
      <div><span className="rs-stage">{task.stage}</span><strong>{task.title}</strong></div>
      {task.order && <Link href={"/studio/orders#" + task.order} aria-label={"Заказ " + task.order}><span>{task.order}</span><ArrowUpRight size={17}/></Link>}
    </li>)}</ol>;
}
