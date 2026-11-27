"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, EmptyState, Input, Textarea } from "@/components/ui";
import { track } from "@/lib/analytics";
import { useStore } from "./StoreProvider";

export function CustomPage() {
  const { addBrief, demo } = useStore();
  const [sent, setSent] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!demo) return;
    const data = new FormData(event.currentTarget);
    const idea = String(data.get("idea")).trim();
    if (!idea) { const field = event.currentTarget.elements.namedItem("idea") as HTMLTextAreaElement; field.setCustomValidity("Опишите идею проекта."); field.reportValidity(); return; }
    addBrief({ idea, budget: String(data.get("budget")), deadline: String(data.get("deadline")), reference: String(data.get("reference")) });
    track("custom_request_submitted", { demo: true });
    setSent(true);
  }
  if (!demo) return <section className="store-page"><h1>Индивидуальный проект</h1><EmptyState title="Приём заявок пока закрыт" action={<Link href="/catalog">Посмотреть коллекцию</Link>} /></section>;
  return <section className="store-page store-narrow"><div className="store-page-head"><h1>Индивидуальный проект</h1></div>
    {sent ? <EmptyState title="Идея сохранена" description="Демо-черновик доступен в вашем профиле." action={<Link href="/profile" className="store-primary-link">В профиль</Link>} />
      : <form onSubmit={submit} className="store-form"><p>Опишите интерьер и важные детали. Это локальный черновик для будущего обсуждения с мастером.</p>
        <Textarea name="idea" label="Ваша идея" rows={4} onInput={e => e.currentTarget.setCustomValidity("")} required maxLength={2000} placeholder="Например, гостиная из дома детства" />
        <Input name="reference" type="url" label="Ссылка на референс" placeholder="https://" maxLength={500} />
        <Input name="budget" label="Предполагаемый бюджет, ₽" type="number" min={1} max={100000000} />
        <Input name="deadline" label="Желаемый срок" type="date" />
        <Button type="submit">Сохранить идею</Button>
      </form>}
  </section>;
}
