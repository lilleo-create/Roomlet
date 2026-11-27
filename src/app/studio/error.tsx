"use client";
import Link from "next/link";
import { RetryPageButton } from "@/components/ui";
export default function StudioError() {
  return <main className="rs-content"><h1>Мастерская временно недоступна</h1><p>Проверьте подключение и попробуйте снова.</p><RetryPageButton /> <Link href="/studio">В мастерскую</Link></main>;
}
