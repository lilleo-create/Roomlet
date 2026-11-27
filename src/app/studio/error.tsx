"use client";
import Link from "next/link";
export default function StudioError({reset}:{reset:()=>void}) {
  return <main className="rs-content"><h1>Мастерская временно недоступна</h1><p>Проверьте подключение и попробуйте снова.</p><button className="rs-primary" onClick={reset}>Повторить</button> <Link href="/studio">В мастерскую</Link></main>;
}
