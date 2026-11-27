import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Input, PageHeading } from "@/components/ui";
import { createRoomletClient } from "@/lib/supabase/server";
import { setInvitationPassword } from "../actions";
import "../invite.css";

export default async function InvitationPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createRoomletClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/studio/invitation?error=expired");
  const { error } = await searchParams;
  return <main className="rs-invitation">
    <Link className="rs-logotype" href="/">roomlet<span>.</span></Link>
    <PageHeading title="Пароль для входа" description="Почта подтверждена. Доступ в Studio откроется, когда владелец назначит вам роль мастера." />
    <form action={setInvitationPassword}>
      <Input label="Новый пароль" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required hint="Минимум 8 символов" />
      {error && <p role="alert">Не удалось сохранить пароль. Введите другой пароль и попробуйте ещё раз.</p>}
      <Button type="submit">Сохранить пароль</Button>
    </form>
  </main>;
}
