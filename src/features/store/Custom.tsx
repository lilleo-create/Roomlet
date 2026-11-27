"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PageHeading, Button, EmptyState, Input, Textarea } from "@/components/ui";
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
  if (!demo) return <section className="store-page store-narrow">
    <PageHeading title="Индивидуальный проект" description="В основе такой миниатюры — ваш интерьер, эскиз или фотография." />
    <EmptyState variant="project" title="Приём заявок пока закрыт"
      description="В каталоге можно посмотреть модели для изготовления по образцу."
      action={<Link className="store-primary-link" href="/catalog?availability=made">В каталог под заказ</Link>} />
  </section>;
  return <section className="store-page store-narrow"><PageHeading title="Индивидуальный проект" description={sent ? undefined : "Опишите интерьер и важные детали будущей миниатюры."} />
    {sent ? <EmptyState variant="saved" title="Идея сохранена" description="Демо-черновик доступен в разделе «Мои заказы»." action={<Link href="/profile/orders" className="store-primary-link">Мои заказы</Link>} />
      : <form onSubmit={submit} className="store-form">
        <Textarea name="idea" label="Ваша идея" rows={4} onInput={e => e.currentTarget.setCustomValidity("")} required maxLength={2000} placeholder="Например, гостиная из дома детства" />
        <Input name="reference" type="url" label="Ссылка на референс" placeholder="https://" maxLength={500} />
        <Input name="budget" label="Предполагаемый бюджет, ₽" type="number" min={1} max={100000000} />
        <Input name="deadline" label="Желаемый срок" type="date" />
        <Button type="submit">Сохранить идею</Button>
      </form>}
  </section>;
}
