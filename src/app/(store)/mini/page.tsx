import type { Metadata } from "next";
import Link from "next/link";
import { miniEnabled } from "@/lib/telegram/config.server";
import { MiniLaunch } from "@/features/profile/MiniLaunch";
import { LaunchReady } from "@/features/launch/LaunchProvider";
export const metadata: Metadata = {title:"Вход из Telegram",robots:{index:false,follow:false}};
export default function MiniPage() {
  return <section className="store-page store-narrow"><h1>Roomlet в Telegram</h1>
    {miniEnabled() ? <MiniLaunch /> : <><p>Вход из Telegram ещё не подключён.</p><LaunchReady /></>}
    <Link className="store-back" href="/">Открыть магазин</Link>
  </section>;
}
