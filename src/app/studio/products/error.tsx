"use client";
import { Button, ErrorState } from "@/components/ui";
export default function InventoryError({reset}: {reset:()=>void}) {
  return <main className="rs-content"><ErrorState title="Не удалось открыть изделия" description="Проверьте соединение и повторите загрузку."
    action={<Button onClick={reset}>Повторить</Button>}/></main>;
}
