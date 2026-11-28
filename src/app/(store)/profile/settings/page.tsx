import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, Input, PageHeading } from "@/components/ui";
import { readAccount, roleLabels } from "@/features/profile/session";
import { miniEnabled, webTelegramEnabled } from "@/lib/telegram/config.server";
import { updateDisplayName } from "../actions";

export default async function ProfileSettings({ searchParams }: { searchParams: Promise<{ result?: string;telegram?:string }> }) {
  const account = await readAccount();
  if (!account) redirect("/profile/login?next=/profile/settings");
  const { result,telegram } = await searchParams;
  return <section className="store-page store-narrow profile-subpage">
    <Link href="/profile" className="store-back"><ArrowLeft size={16} aria-hidden /> Мой профиль</Link>
    <PageHeading title="Настройки профиля" />
    <form action={updateDisplayName} className="store-form">
      <Input label="Имя в профиле" name="display_name" defaultValue={account.name} maxLength={100}
        hint="Если оставить поле пустым, в профиле будет виден адрес почты." autoComplete="name" />
      <dl className="profile-account-details"><div><dt>Почта</dt><dd>{account.email || "Не указана"}</dd></div>
        <div><dt>Telegram</dt><dd>{account.telegramLinked ? "Подключён" : webTelegramEnabled()
          ? <Link href="/profile/telegram">Привязать Telegram</Link> : miniEnabled()
          ? <a href="https://t.me/roomlet_shop_bot?startapp=link">Привязать Telegram</a> : "Привязка пока недоступна"}</dd></div>
        <div><dt>Роль</dt><dd>{roleLabels[account.role]}</dd></div></dl>
      {result === "saved" && <p role="status">Настройки сохранены.</p>}
      {telegram === "linked" && <p role="status">Telegram подключён к вашему аккаунту.</p>}
      {telegram === "conflict" && <p role="alert">Этот Telegram уже связан с другим аккаунтом. Автоматическое объединение отключено.</p>}
      {telegram === "error" && <p role="alert">Привязка не завершена. Попробуйте ещё раз.</p>}
      {result === "invalid" && <p role="alert">В имени должно быть не больше 100 символов.</p>}
      {result === "error" && <p role="alert">Не удалось сохранить имя. Попробуйте ещё раз.</p>}
      <Button type="submit">Сохранить имя</Button>
    </form>
  </section>;
}
