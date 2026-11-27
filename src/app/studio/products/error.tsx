"use client";
import { RetryPageButton, ErrorState } from "@/components/ui";
export default function InventoryError() {
  return <main className="rs-content"><ErrorState title="Не удалось открыть изделия" description="Проверьте соединение и повторите загрузку."
    action={<RetryPageButton />}/></main>;
}
