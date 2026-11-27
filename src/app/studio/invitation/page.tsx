import type { Metadata } from "next";
import Link from "next/link";
import { Button, PageHeading } from "@/components/ui";
import { acceptInvitation } from "./actions";
import "./invite.css";

export const metadata: Metadata = { referrer: "no-referrer", title: "Приглашение в мастерскую" };

export default async function InvitationPage({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const { token_hash: token } = await searchParams;
  return <main className="rs-invitation">
    <Link className="rs-logotype" href="/">roomlet<span>.</span></Link>
    <PageHeading title="Приглашение в мастерскую" />
    {typeof token === "string" && /^[\w-]{24,256}$/.test(token) ?
      <form action={acceptInvitation}>
        <p>Подтвердите приглашение из письма и задайте пароль для входа.</p>
        <input type="hidden" name="token_hash" value={token} />
        <Button type="submit">Принять приглашение</Button>
      </form> : <p>Ссылка недействительна или истекла. Попросите владельца мастерской прислать новое приглашение.</p>}
  </main>;
}
