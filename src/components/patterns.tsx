import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { ObjectNumber, StatusTag } from "./ui";

type OrderCardProps = { number: string; title: string; status: string; detail?: string; href?: string };
export function OrderCard({ number, title, status, detail, href }: OrderCardProps) {
  const content = <>
    <div className="ui-order-meta"><ObjectNumber value={number} /><StatusTag tone="primary">{status}</StatusTag></div>
    <h3>{title}{href && <ArrowUpRight size={19} aria-hidden />}</h3>
    {detail && <p>{detail}</p>}
  </>;
  return href ? <Link className="ui-order" href={href}>{content}</Link> : <article className="ui-order">{content}</article>;
}

type Step = { label: string; detail?: string; state: "done" | "active" | "upcoming" };
const states = { done: "Завершено", active: "Текущий этап", upcoming: "Впереди" };
export function OrderTimeline({ steps }: { steps: Step[] }) {
  return <ol className="ui-timeline" aria-label="Этапы заказа">{steps.map((step) =>
    <li key={step.label} className={`ui-step ui-step--${step.state}`} aria-current={step.state === "active" ? "step" : undefined}>
      <span className="ui-step-dot" aria-hidden="true">{step.state === "done" && <Check size={12} />}</span>
      <div><strong>{step.label}</strong><span className="ui-visually-hidden"> — {states[step.state]}</span>
        {step.detail && <p>{step.detail}</p>}
      </div>
    </li>
  )}</ol>;
}
