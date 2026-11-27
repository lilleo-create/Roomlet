"use client";
import { RetryPageButton, ErrorState, PageHeading } from "@/components/ui";

export default function ProfileError() {
  return <section className="store-page store-narrow"><PageHeading title="Мой профиль" />
    <ErrorState title="Не удалось загрузить страницу" description="Проверьте соединение и попробуйте ещё раз."
      action={<RetryPageButton />} /></section>;
}
