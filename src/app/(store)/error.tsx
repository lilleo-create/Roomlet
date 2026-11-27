"use client";
import { Button, ErrorState } from "@/components/ui";
export default function CatalogError({ reset }: { reset: () => void }) {
  return <section className="store-page"><h1>Витрина Roomlet</h1><ErrorState title="Не удалось открыть витрину" description="Проверьте соединение и попробуйте ещё раз."
    action={<Button onClick={reset}>Повторить</Button>} /></section>;
}
