import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, PageHeading } from "@/components/ui";
import { readAccount } from "@/features/profile/session";
import { createRoomletClient } from "@/lib/supabase/server";
import { saveNotifications } from "./actions";
import "./notifications.css";

export default async function NotificationSettings({ searchParams }: {
  searchParams: Promise<{ result?: string }>;
}) {
  const account = await readAccount();
  if (!account) redirect("/profile/login?next=/profile/notifications");
  const client = await createRoomletClient();
  const { data, error } = await client.from("notification_preferences")
    .select("order_updates, marketing_opt_in").eq("profile_id", account.id).maybeSingle();
  const { result } = await searchParams;

  return <section className="store-page store-narrow profile-subpage">
    <Link href="/profile" className="store-back"><ArrowLeft size={16} aria-hidden /> Мой профиль</Link>
    <PageHeading title="Уведомления" description="Выберите, какие письма о мастерской и заказах вы хотите получать." />
    {error ? <p role="status">Настройки писем временно недоступны. Попробуйте открыть страницу позже.</p> :
      <form action={saveNotifications} className="store-form notification-form">
        <label><span><strong>Мои заказы</strong><small>Изменения статуса и готовность изделия.</small></span>
          <input type="checkbox" name="order_updates" defaultChecked={data?.order_updates ?? false} /></label>
        <label><span><strong>Новости мастерской</strong><small>Я соглашаюсь получать по электронной почте новости коллекций и предложения Roomlet. Согласие можно отозвать здесь.</small></span>
          <input type="checkbox" name="marketing_opt_in" defaultChecked={data?.marketing_opt_in ?? false} /></label>
        {result === "saved" && <p role="status">Настройки сохранены.</p>}
        {result === "error" && <p role="alert">Не удалось сохранить настройки. Попробуйте ещё раз.</p>}
        <Button type="submit">Сохранить настройки</Button>
      </form>}
  </section>;
}
