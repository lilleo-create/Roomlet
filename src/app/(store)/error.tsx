"use client";
import { PageHeading, RetryPageButton, ErrorState } from "@/components/ui";
export default function CatalogError() {
  return <section className="store-page"><PageHeading title="Витрина Roomlet" /><ErrorState title="Не удалось открыть витрину" description="Проверьте соединение и попробуйте ещё раз."
    action={<RetryPageButton />} /></section>;
}
