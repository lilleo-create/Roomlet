import { redirect } from "next/navigation";
import { readAccount } from "@/features/profile/session";
import { MiniLaunch } from "@/features/profile/MiniLaunch";
import { miniEnabled } from "@/lib/telegram/config.server";
export const metadata = {title:"Привязать Telegram",robots:{index:false,follow:false}};
export default async function LinkTelegram() {
  if (!miniEnabled()) redirect("/profile/settings");
  const account = await readAccount();
  if (!account) redirect("/profile/login?next=/mini/link");
  return <section className="store-page store-narrow"><h1>Привязать Telegram</h1>
    <p>Подключить текущий Telegram к аккаунту {account.email || account.name}?</p>
    <MiniLaunch accountId={account.id} />
  </section>;
}
