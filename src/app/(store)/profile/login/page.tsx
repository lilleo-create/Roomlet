import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button, Input, PageHeading } from "@/components/ui";
import { readAccount } from "@/features/profile/session";
import { enterProfile } from "../actions";

export default async function ProfileLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await readAccount()) redirect("/profile");
  const { error } = await searchParams;
  return <section className="store-page store-narrow profile-subpage">
    <Link href="/profile" className="store-back"><ArrowLeft size={16} aria-hidden /> Мой профиль</Link>
    <PageHeading title="Вход в профиль" />
    <form action={enterProfile} className="store-form">
      <Input label="Электронная почта" name="email" type="email" autoComplete="username" maxLength={320} required />
      <Input label="Пароль" name="password" type="password" autoComplete="current-password" maxLength={4096} required />
      {error && <p role="alert">{error === "credentials" ? "Проверьте адрес почты и пароль." : "Не удалось войти. Попробуйте ещё раз."}</p>}
      <Button type="submit">Войти <ArrowRight size={18} aria-hidden /></Button>
    </form>
  </section>;
}
